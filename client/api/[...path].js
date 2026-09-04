// A hand-rolled reverse proxy to the Render backend, running as a real Vercel Serverless Function.
//
// Needed because vercel.json's plain `rewrites` to an external absolute URL only reliably proxy
// GET/HEAD requests — POST/PATCH/DELETE (login, and literally every mutation in this app) came
// back as a 405 from Vercel's own edge, never even reaching Render. A real function has no such
// restriction: it forwards the method, the raw body, and every response header (including
// multiple Set-Cookie headers, which is what login actually depends on) exactly as received.
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

  const pathSegments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const queryIndex = req.url.indexOf("?");
  const search = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
  const targetUrl = `${API_ORIGIN}/api/${pathSegments.join("/")}${search}`;

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
