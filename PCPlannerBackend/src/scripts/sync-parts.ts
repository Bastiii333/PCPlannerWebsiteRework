import "dotenv/config";
import { supabaseRequest } from "../supabase.js";

type GitHubTreeFile = { path: string; type: string };
type GitHubTreeResponse = { truncated: boolean; tree: GitHubTreeFile[] };
type CpuEnrichment = {
  name: string;
  partNumber: string | undefined;
  memoryType: string | undefined;
  nativeMemorySpeed: number | undefined;
  maxMemoryCapacity: number | undefined;
  tdp: number | undefined;
};

const PART_TYPES = ["CPU", "GPU", "Motherboard", "PSU", "RAM", "Storage"] as const;
const BATCH_SIZE = 500;
const DOWNLOAD_CONCURRENCY = 8;
const DOWNLOAD_WINDOW_SIZE = DOWNLOAD_CONCURRENCY * 4;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const OPENDB_ROOT =
  "https://raw.githubusercontent.com/buildcores/buildcores-open-db/main/";
const GPU_SOURCE_URLS = [
  "https://raw.githubusercontent.com/RightNow-AI/RightNow-GPU-Database/main/data/nvidia/all.json",
  "https://raw.githubusercontent.com/RightNow-AI/RightNow-GPU-Database/main/data/amd/all.json",
  "https://raw.githubusercontent.com/RightNow-AI/RightNow-GPU-Database/main/data/intel/all.json",
];
const NUCLEUS_CPU_TREE_URL =
  "https://api.github.com/repos/QingYi-Studio/NucleusAPI/git/trees/main?recursive=1";
const NUCLEUS_CPU_ROOT =
  "https://raw.githubusercontent.com/QingYi-Studio/NucleusAPI/main/";

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

function normalizedName(value: unknown): string {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
}

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

async function getCpuEnrichments(): Promise<Map<string, CpuEnrichment>> {
  const tree = await fetchJson<GitHubTreeResponse>(NUCLEUS_CPU_TREE_URL, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "PCPlannerBackend" },
  });
  if (tree.truncated) throw new Error("NucleusAPI returned a truncated file list");

  const cpuFiles = tree.tree.filter(
    (file) => file.type === "blob" && /^data\/cpu\/[^/]+\/[^/]+\.json$/i.test(file.path),
  );
  const enrichments = new Map<string, CpuEnrichment>();
  const records = await Promise.all(cpuFiles.map(async (file) => {
    const data = await fetchJson<unknown>(`${NUCLEUS_CPU_ROOT}${file.path}`);
    return nestedRecord(data);
  }));

  for (const record of records) {
    if (!record || typeof record.name !== "string") continue;
    const memory = nestedRecord(record.memory);
    const tdp = nestedRecord(record.tdp);
    const enrichment: CpuEnrichment = {
      name: record.name,
      partNumber: typeof record.part_number === "string" ? record.part_number : undefined,
      memoryType: typeof memory?.type === "string" ? memory.type : undefined,
      nativeMemorySpeed: typeof memory?.native_speed_mt_s === "number"
        ? memory.native_speed_mt_s
        : undefined,
      maxMemoryCapacity: typeof memory?.max_capacity_gb === "number"
        ? memory.max_capacity_gb
        : undefined,
      tdp: typeof tdp?.tdp_w === "number" ? tdp.tdp_w : undefined,
    };
    enrichments.set(normalizedName(enrichment.name), enrichment);
    if (enrichment.partNumber) enrichments.set(normalizedName(enrichment.partNumber), enrichment);
  }
  console.log(`Loaded ${enrichments.size} NucleusAPI CPU enrichment keys`);
  return enrichments;
}

function enrichCpu(
  part: Record<string, unknown>,
  enrichments: Map<string, CpuEnrichment>,
): Record<string, unknown> {
  const metadata = nestedRecord(part.metadata);
  const candidates = [
    metadata?.name,
    part.name,
    ...(Array.isArray(metadata?.part_numbers) ? metadata.part_numbers : []),
    part.part_number,
  ];
  const enrichment = candidates
    .map((candidate) => enrichments.get(normalizedName(candidate)))
    .find((match): match is CpuEnrichment => match !== undefined);
  if (!enrichment) return part;

  const specifications = { ...(nestedRecord(part.specifications) ?? {}) };
  const memory = { ...(nestedRecord(specifications.memory) ?? {}) };
  if ((!isPositiveNumber(memory.maxSpeed)) && enrichment.nativeMemorySpeed !== undefined) {
    memory.maxSpeed = enrichment.nativeMemorySpeed;
  }
  if ((!isPositiveNumber(memory.maxSupport)) && enrichment.maxMemoryCapacity !== undefined) {
    memory.maxSupport = enrichment.maxMemoryCapacity;
  }
  if ((!Array.isArray(memory.types) || memory.types.length === 0) && enrichment.memoryType !== undefined) {
    memory.types = [enrichment.memoryType];
  }
  if (specifications.tdp === undefined && enrichment.tdp !== undefined) {
    specifications.tdp = enrichment.tdp;
  }

  function isPositiveNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }

  return {
    ...part,
    specifications: { ...specifications, memory },
  };
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

async function replaceGpuCatalog(): Promise<number> {
  const vendorCatalogs = await Promise.all(
    GPU_SOURCE_URLS.map((url) => fetchJson<unknown>(url)),
  );
  const records = vendorCatalogs.flatMap((catalog) => {
    if (!Array.isArray(catalog)) {
      throw new Error("GPU source returned an invalid catalog");
    }
    return catalog
      .filter((part): part is Record<string, unknown> =>
        Boolean(part) && typeof part === "object" && !Array.isArray(part),
      )
      .map((part) => {
        const id = typeof part.id === "string" ? part.id : undefined;
        if (!id) throw new Error("GPU source record is missing an id");
        return {
          part_type: "GPU",
          opendb_id: `rightnow-${id}`,
          search_text: searchableText(part).toLowerCase(),
          data: part,
          synced_at: new Date().toISOString(),
        };
      });
  });

  const deleteResponse = await supabaseRequest("parts?part_type=eq.GPU", {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!deleteResponse.ok) {
    throw new Error(`Supabase GPU replacement delete failed: HTTP ${deleteResponse.status}`);
  }

  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    await upsertBatch("GPU", records.slice(start, start + BATCH_SIZE));
  }
  console.log(`Replaced GPU catalog with ${records.length} RightNow records`);
  return records.length;
}

async function syncPartType(
  partType: string,
  files: GitHubTreeFile[],
  cpuEnrichments?: Map<string, CpuEnrichment>,
): Promise<number> {
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
      const sourceData = partType === "CPU" && cpuEnrichments
        ? enrichCpu(data as Record<string, unknown>, cpuEnrichments)
        : data;
      records.push({
        part_type: partType,
        opendb_id: getOpenDbId(data as Record<string, unknown>, file.path),
        search_text: searchableText(sourceData).toLowerCase(),
        data: sourceData,
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
const cpuEnrichments = await getCpuEnrichments();
let total = 0;
for (const partType of PART_TYPES) {
  total += partType === "GPU"
    ? await replaceGpuCatalog()
    : await syncPartType(partType, files, cpuEnrichments);
}
console.log(`Synced ${total} parts`);
