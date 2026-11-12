import "dotenv/config";

type SupabaseConfig = {
  url: string;
  key: string;
};

function getEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isPublicSupabaseKey(value: string): boolean {
  const normalized = value.toLowerCase();
  if (
    normalized.startsWith("sb_publishable_") ||
    normalized.startsWith("sb_anon_")
  ) {
    return true;
  }

  const [, payload] = value.split(".");
  if (!payload) return false;

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { role?: unknown };
    return claims.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = getEnv("SUPABASE_URL", "API_URL", "ProjectURL");
  const key = getEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "APIKey",
    "SecretKey"
  );

  if (!url) {
    throw new Error(
      "Supabase URL is missing. Set SUPABASE_URL (API_URL and ProjectURL are also supported)."
    );
  }

  const hasPublicKey = Boolean(
    getEnv("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "PublishableKey")
  );
  if (!key || isPublicSupabaseKey(key)) {
    throw new Error(
      hasPublicKey
        ? "Supabase server credential is invalid. Publishable/anon keys cannot be used for server sync or writes; set a secret/service-role key using SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, APIKey, or SecretKey."
        : key
          ? "Supabase server credential is invalid. Use a secret/service-role key for server sync and writes."
          : "Supabase server credential is missing. Set SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, APIKey, or SecretKey for server sync and writes."
    );
  }

  const normalizedUrl = url.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
  return { url: normalizedUrl, key };
}

export async function supabaseRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const config = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", config.key);
  headers.set("Authorization", `Bearer ${config.key}`);
  headers.set("Accept", "application/json");

  return fetch(`${config.url}/rest/v1/${path}`, { ...init, headers });
}
