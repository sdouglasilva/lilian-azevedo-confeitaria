import { requireSupabaseConfig } from "@/lib/config/env";

export class SupabaseHttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type RpcOptions = { accessToken?: string };

async function parseResponse(response: Response) {
  if (response.ok) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  const body = await response.json().catch(() => ({}));
  throw new SupabaseHttpError(response.status, body.code || body.error_code || "SUPABASE_ERROR", body.message || body.error_description || "Falha no Supabase");
}

export async function rpc<T = unknown>(name: string, params: Record<string, unknown>, options: RpcOptions = {}): Promise<T> {
  const config = requireSupabaseConfig();
  const headers: Record<string, string> = {
    apikey: config.supabaseKey,
    "content-type": "application/json",
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: "POST", headers, body: JSON.stringify(params), cache: "no-store",
  });
  return (await parseResponse(response)) as T;
}

export async function tableGet<T = unknown>(path: string, accessToken: string): Promise<T> {
  const config = requireSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: config.supabaseKey, Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  return (await parseResponse(response)) as T;
}

export function publicImageUrl(path?: string | null): string | null {
  if (!path) return null;
  const { supabaseUrl } = requireSupabaseConfig();
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}
