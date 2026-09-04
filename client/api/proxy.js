// A hand-rolled reverse proxy to the Render backend, running as a real Vercel Serverless Function.
//
// This is a single, plain function file (not the `[...path].js` dynamic catch-all convention) —
// that convention turned out not to route correctly on this project (confirmed by testing a plain
// client/api/health.js function, which worked fine, immediately after `[...path].js` returned a
// platform-level 404 for every request). Every `/api/*` request instead reaches this one function
// via an internal rewrite (see client/vercel.json: "/api/(.*)" -> "/api/proxy?path=$1"), which
// hands the real path through as a query parameter this function reads directly, sidestepping
// Vercel's dynamic-file-route matching entirely.
//
// A plain `rewrites` entry straight to an *external* absolute URL (skipping this function) was
// tried even earlier and reverted: it only reliably proxies GET/HEAD, so every POST (starting with
// login) came back a `405` straight from Vercel's edge, never reaching Render. Rewriting to an
// *internal* path (this function) has no such method restriction.
//
// Read via plain `process.env`, not `import.meta.env.VITE_...` — this file runs as a Node.js
// Serverless Function, a completely different environment from the Vite browser bundle. A
// `VITE_` prefix specifically means "expose this to the public browser bundle," which is the
// opposite of what this value needs — the browser never sees it, only this function does. Set
// `API_ORIGIN` directly in Vercel's project environment variables (see client/.env.example).
const API_ORIGIN = process.env.API_ORIGIN;

// Forward the exact bytes the client sent, not a re-serialized copy — avoids subtly mismatching
// Content-Length/encoding for anything that isn't simple JSON.
export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const HOP_BY_HOP_REQUEST_HEADERS = new Set(["host", "connection", "content-length"]);
const SKIPPED_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "content-encoding",
  "transfer-encoding",
  "content-length",
  "connection",
]);

export default async function handler(req, res) {
  if (!API_ORIGIN) {
    console.error("[api-proxy] API_ORIGIN is not set — cannot forward any /api/* request.");
    res.status(500).json({ error: "Server misconfiguration: API_ORIGIN is not set." });
    return;
  }

  // `path` is injected by the vercel.json rewrite ("/api/(.*)" -> "/api/proxy?path=$1") and
  // carries the real sub-path (e.g. "auth/login"), already URL-decoded by Vercel's query parser.
  // Everything else in req.query is a real query parameter from the original request (e.g.
  // "status=served&page=2") and needs to be forwarded as-is, not dropped.
  const { path: rewrittenPath, ...restQuery } = req.query;
  const search = new URLSearchParams(restQuery).toString();
  const targetUrl = `${API_ORIGIN}/api/${rewrittenPath ?? ""}${search ? `?${search}` : ""}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase()) || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await readRawBody(req) : undefined;

  const upstreamResponse = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  res.status(upstreamResponse.status);

  // A response can carry more than one Set-Cookie header — the standard Headers API's own
  // .get()/.forEach() incorrectly comma-joins them into one invalid value, so this is the one
  // header that needs its own dedicated, order-preserving accessor.
  const setCookies =
    typeof upstreamResponse.headers.getSetCookie === "function" ? upstreamResponse.headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }

  upstreamResponse.headers.forEach((value, key) => {
    if (SKIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });

  const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
  res.send(buffer);
}
