
import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
}));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "PC Planner backend is running",
  });
});



type GitHubTreeFile = {
  path: string;
  type: string;
  sha: string;
};

type GitHubTreeResponse = {
  truncated: boolean;
  tree: GitHubTreeFile[];
};

const partFileListCache = new Map<string, {
  files: GitHubTreeFile[];
  expiresAt: number;
}>();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CPU_FILE_LIST_CACHE_MS = 5 * 60 * 1000;

async function getPartFiles(partType: string): Promise<GitHubTreeFile[]> {
  const cached = partFileListCache.get(partType);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.files;
  }

  const treeResponse = await fetch(
    "https://api.github.com/repos/buildcores/buildcores-open-db/git/trees/main?recursive=1",
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "PCPlannerBackend",
      },
    }
  );

  if (!treeResponse.ok) {
    throw new Error(
      `GitHub tree request failed: ${treeResponse.status} ${await treeResponse.text()}`
    );
  }

  const treeResult = (await treeResponse.json()) as GitHubTreeResponse;

  if (treeResult.truncated) {
    throw new Error(
      "GitHub returned a truncated file list. A different retrieval method is needed."
    );
  }

  const partFiles = treeResult.tree.filter(
    (file) =>
      file.type === "blob" &&
      new RegExp(`^open-db/${partType}/[^/]+\\.json$`, "i").test(file.path)
  );

  partFileListCache.set(partType, {
    files: partFiles,
    expiresAt: Date.now() + CPU_FILE_LIST_CACHE_MS,
  });
  return partFiles;
}

function parseNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return fallback;
  }

  return Number(value);
}

async function getParts(partType: string, req: express.Request, res: express.Response) {
  try {
    const offset = parseNonNegativeInteger(req.query.offset, 0);
    const requestedLimit = parseNonNegativeInteger(
      req.query.limit,
      DEFAULT_PAGE_SIZE
    );
    const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
    const partFiles = await getPartFiles(partType);
    const pageFiles = partFiles.slice(offset, offset + limit);

    const parts: unknown[] = [];
    const failedFiles: string[] = [];
    const concurrency = 10;

    for (let i = 0; i < pageFiles.length; i += concurrency) {
      const batch = pageFiles.slice(i, i + concurrency);

      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const response = await fetch(
              `https://raw.githubusercontent.com/buildcores/buildcores-open-db/main/${file.path}`
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
          } catch (error) {
            console.error(`Failed to fetch ${file.path}:`, error);
            failedFiles.push(file.path);
            return null;
          }
        })
      );

      parts.push(...results.filter((part) => part !== null));
    }

    res.json({
      count: parts.length,
      totalFiles: partFiles.length,
      offset,
      limit,
      hasMore: offset + pageFiles.length < partFiles.length,
      failedCount: failedFiles.length,
      data: parts,
    });
  } catch (error) {
    console.error("CPU catalog error:", error);

    res.status(502).json({
      message: "Failed to fetch CPU data from BuildCores OpenDB",
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
}

app.get("/api/cpus", (req, res) => getParts("CPU", req, res));
app.get("/api/gpus", (req, res) => getParts("GPU", req, res));
app.get("/api/motherboards", (req, res) => getParts("Motherboard", req, res));
app.get("/api/psus", (req, res) => getParts("PSU", req, res));
app.get("/api/rams", (req, res) => getParts("RAM", req, res));


export default app;
