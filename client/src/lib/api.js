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

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};
