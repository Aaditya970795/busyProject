import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

async function request(path, options = {}) {
  try {
    const res = await client.request({
      url: path,
      method: options.method,
      data: options.body,
      headers: options.headers,
    });
    return res.data ?? null;
  } catch (err) {
    if (err.response) {
      const error = new Error(err.response.data?.error || `Request failed with status ${err.response.status}`);
      error.status = err.response.status;
      throw error;
    }
    throw err;
  }
}

function filenameFromContentDisposition(header) {
  const match = /filename="([^"]+)"/.exec(header ?? "");
  return match?.[1] ?? "download";
}

// For endpoints that return a file (e.g. CSV export) instead of JSON. Uses responseType: "blob"
// so the body is never run through axios's JSON parsing, but that also means an error response's
// body arrives as a Blob instead of a parsed object — so on failure this reads that blob back out
// as text to recover the server's actual error message instead of just a generic status message.
async function downloadFile(path) {
  try {
    const res = await client.get(path, { responseType: "blob" });
    return { blob: res.data, filename: filenameFromContentDisposition(res.headers["content-disposition"]) };
  } catch (err) {
    if (err.response) {
      let message = `Request failed with status ${err.response.status}`;
      if (err.response.data instanceof Blob && err.response.data.type.includes("json")) {
        try {
          message = JSON.parse(await err.response.data.text())?.error || message;
        } catch {
          // Body wasn't valid JSON after all — fall back to the generic message above.
        }
      }
      const error = new Error(message);
      error.status = err.response.status;
      throw error;
    }
    throw err;
  }
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  downloadFile,
};
