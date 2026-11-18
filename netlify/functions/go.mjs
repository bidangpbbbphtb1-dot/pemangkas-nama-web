// Pengalih: nama-situs.netlify.app/<kode>  →  link asli
import { getStore } from "@netlify/blobs";

const notFound = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Link tidak ditemukan</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f3f6f4;color:#1f3d33}
.k{text-align:center;padding:2rem}h1{font-size:4rem;margin:0;color:#2e8b62}p{color:#5b6f67}</style></head>
<body><div class="k"><h1>404</h1><p>Link pendek ini tidak ada atau sudah dihapus.</p></div></body></html>`;

export default async (req, context) => {
  const code = context.params.code || "";
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) {
    return new Response(notFound, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const store = getStore({ name: "links", consistency: "strong" });
  const data = await store.get(code, { type: "json" });
  if (!data || !data.url) {
    return new Response(notFound, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  data.clicks = (data.clicks || 0) + 1;
  data.lastClick = Date.now();
  try { await store.setJSON(code, data); } catch (e) { /* hitungan klik gagal, tetap alihkan */ }
  return new Response(null, {
    status: 302,
    headers: { location: data.url, "cache-control": "no-store" },
  });
};

export const config = { path: "/:code", preferStatic: true };
