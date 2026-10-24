
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

const cpuFileListCache: {
  files: GitHubTreeFile[];
  expiresAt: number;
} = {
  files: [],
  expiresAt: 0,
};

const CPU_PAGE_SIZE = 20;
const MAX_CPU_PAGE_SIZE = 100;
const CPU_FILE_LIST_CACHE_MS = 5 * 60 * 1000;

async function getCpuFiles(): Promise<GitHubTreeFile[]> {
  if (cpuFileListCache.expiresAt > Date.now()) {
    return cpuFileListCache.files;
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

  const cpuFiles = treeResult.tree.filter(
    (file) =>
      file.type === "blob" &&
      /^open-db\/CPU\/[^/]+\.json$/i.test(file.path)
  );

  cpuFileListCache.files = cpuFiles;
  cpuFileListCache.expiresAt = Date.now() + CPU_FILE_LIST_CACHE_MS;
  return cpuFiles;
}

function parseNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return fallback;
  }

  return Number(value);
}

app.get("/api/cpus", async (req, res) => {
  try {
    const offset = parseNonNegativeInteger(req.query.offset, 0);
    const requestedLimit = parseNonNegativeInteger(
      req.query.limit,
      CPU_PAGE_SIZE
    );
    const limit = Math.min(requestedLimit, MAX_CPU_PAGE_SIZE);
    const cpuFiles = await getCpuFiles();
    const pageFiles = cpuFiles.slice(offset, offset + limit);

    const cpus: unknown[] = [];
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

      cpus.push(...results.filter((cpu) => cpu !== null));
    }

    res.json({
      count: cpus.length,
      totalFiles: cpuFiles.length,
      offset,
      limit,
      hasMore: offset + pageFiles.length < cpuFiles.length,
      failedCount: failedFiles.length,
      data: cpus,
    });
  } catch (error) {
    console.error("CPU catalog error:", error);

    res.status(502).json({
      message: "Failed to fetch CPU data from BuildCores OpenDB",
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
});


export default app;
