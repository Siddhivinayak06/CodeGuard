// lib/fetch.ts
export async function safeFetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: "same-origin", ...opts });
  const text = await res.text();
  if (!res.ok)
    throw new Error(
      `HTTP ${res.status} ${res.statusText} - ${text || "<no body>"}`,
    );
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
