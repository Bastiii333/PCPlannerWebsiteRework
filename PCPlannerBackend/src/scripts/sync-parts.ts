import "dotenv/config";
import { supabaseRequest } from "../supabase.js";

type GitHubTreeFile = { path: string; type: string };
type GitHubTreeResponse = { truncated: boolean; tree: GitHubTreeFile[] };

const PART_TYPES = ["CPU", "GPU", "Motherboard", "PSU", "RAM", "Storage"] as const;
const BATCH_SIZE = 500;
const DOWNLOAD_CONCURRENCY = 8;
const DOWNLOAD_WINDOW_SIZE = DOWNLOAD_CONCURRENCY * 4;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const OPENDB_ROOT =
  "https://raw.githubusercontent.com/buildcores/buildcores-open-db/main/";

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

function isRetryable(error: unknown): boolean {
  return (
    !(error instanceof HttpError) ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
  );
}

function errorLabel(error: unknown): string {
  if (error instanceof HttpError) return `HTTP ${error.status}`;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "request timed out";
  }
  return "request failed";
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new HttpError(response.status);
      return (await response.json()) as T;
    } catch (error) {
      if (attempt === MAX_RETRIES || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

function searchableText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key} ${searchableText(item)}`).join(" ");
  }
  return "";
}

function getOpenDbId(part: Record<string, unknown>, path: string): string {
  const metadata = part.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const id = (metadata as Record<string, unknown>).opendb_id;
    if (typeof id === "string" && id) return id;
  }
  if (typeof part.opendb_id === "string" && part.opendb_id) return part.opendb_id;
  return path.split("/").pop()?.replace(/\.json$/i, "") ?? path;
}

async function getFiles(): Promise<GitHubTreeFile[]> {
  const result = await fetchJson<GitHubTreeResponse>(
    "https://api.github.com/repos/buildcores/buildcores-open-db/git/trees/main?recursive=1",
    { headers: { Accept: "application/vnd.github+json", "User-Agent": "PCPlannerBackend" } },
  );
  if (result.truncated) throw new Error("GitHub returned a truncated file list");
  return result.tree;
}

async function upsertBatch(
  partType: string,
  batch: Array<Record<string, unknown>>,
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await supabaseRequest(
        "parts?on_conflict=part_type%2Copendb_id",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) throw new HttpError(response.status);
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES || !isRetryable(error)) {
        throw new Error(`Supabase upsert failed for ${partType}: ${errorLabel(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}

async function syncPartType(partType: string, files: GitHubTreeFile[]): Promise<number> {
  const partFiles = files.filter(
    (file) => file.type === "blob" && new RegExp(`^open-db/${partType}/[^/]+\\.json$`, "i").test(file.path)
  );
  const records: Array<Record<string, unknown>> = [];
  let synced = 0;
  console.log(`Downloading ${partFiles.length} ${partType} files...`);

  for (let start = 0; start < partFiles.length; start += DOWNLOAD_WINDOW_SIZE) {
    const window = partFiles.slice(start, start + DOWNLOAD_WINDOW_SIZE);
    const downloaded: Array<{ file: GitHubTreeFile; data: unknown }> = [];
    let nextFile = 0;
    const downloadWorker = async (): Promise<void> => {
      while (nextFile < window.length) {
        const file = window[nextFile];
        nextFile += 1;
        if (!file) continue;
        try {
          const data = await fetchJson<unknown>(`${OPENDB_ROOT}${file.path}`);
          downloaded.push({ file, data });
        } catch (error) {
          console.warn(`Skipping ${file.path}: ${errorLabel(error)}`);
          downloaded.push({ file, data: null });
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(DOWNLOAD_CONCURRENCY, window.length) },
        () => downloadWorker(),
      ),
    );

    for (const { file, data } of downloaded) {
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      records.push({
        part_type: partType,
        opendb_id: getOpenDbId(data as Record<string, unknown>, file.path),
        search_text: searchableText(data).toLowerCase(),
        data,
        synced_at: new Date().toISOString(),
      });
    }

    while (records.length >= BATCH_SIZE) {
      await upsertBatch(partType, records.splice(0, BATCH_SIZE));
      synced += BATCH_SIZE;
    }
    console.log(`Downloaded ${Math.min(start + window.length, partFiles.length)}/${partFiles.length} ${partType} files`);
  }

  if (records.length > 0) {
    await upsertBatch(partType, records);
    synced += records.length;
  }
  console.log(`Synced ${synced} ${partType} parts`);
  return synced;
}

const files = await getFiles();
let total = 0;
for (const partType of PART_TYPES) total += await syncPartType(partType, files);
console.log(`Synced ${total} parts`);
