import express from "express";
import cors from "cors";
import { supabaseRequest } from "./supabase.js";

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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parseNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  return Number(value);
}

async function getParts(partType: string, req: express.Request, res: express.Response) {
  try {
    const offset = parseNonNegativeInteger(req.query.offset, 0);
    const requestedLimit = parseNonNegativeInteger(req.query.limit, DEFAULT_PAGE_SIZE);
    const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const params = new URLSearchParams({
      select: "data,opendb_id",
      part_type: `eq.${partType}`,
      order: "opendb_id.asc",
      offset: String(offset),
      limit: String(limit),
    });
    if (search) params.set("search_text", `ilike.*${search}*`);

    const response = await supabaseRequest(`parts?${params}`, {
      headers: { Prefer: "count=exact" },
    });
    if (!response.ok) {
      throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
    }

    const rows = (await response.json()) as Array<{ data: unknown }>;
    const range = response.headers.get("content-range");
    const total = range?.includes("/")
      ? Number(range.split("/")[1])
      : offset + rows.length;
    const parts = rows.map((row) => row.data);

    res.json({
      count: parts.length,
      totalFiles: Number.isFinite(total) ? total : offset + parts.length,
      offset,
      limit,
      hasMore: offset + parts.length < total,
      failedCount: 0,
      data: parts,
    });
  } catch (error) {
    console.error("Parts catalog error:", error instanceof Error ? error.message : "Unknown error");
    res.status(502).json({
      message: "Failed to fetch parts data from Supabase",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

app.get("/api/cpus", (req, res) => getParts("CPU", req, res));
app.get("/api/gpus", (req, res) => getParts("GPU", req, res));
app.get("/api/motherboards", (req, res) => getParts("Motherboard", req, res));
app.get("/api/psus", (req, res) => getParts("PSU", req, res));
app.get("/api/rams", (req, res) => getParts("RAM", req, res));
app.get("/api/storage", (req, res) => getParts("Storage", req, res));

export default app;
