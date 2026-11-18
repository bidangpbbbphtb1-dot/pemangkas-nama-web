// API admin: buat, lihat, dan hapus link pendek. Dilindungi ADMIN_PASSWORD.
import { getStore } from "@netlify/blobs";

const RESERVED = new Set(["api", "index", "index.html", "favicon.ico", "robots.txt", "admin"]);
const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function randomCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

function cleanUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default async (req, context) => {
  const pass = (typeof Netlify !== "undefined" && Netlify.env.get("ADMIN_PASSWORD")) || "";
  if (!pass) return json({ error: "ADMIN_PASSWORD belum diatur di Netlify." }, 500);
  if (req.headers.get("x-admin-pass") !== pass) return json({ error: "Password salah." }, 401);

  const store = getStore({ name: "links", consistency: "strong" });
  const code = context.params.code;

  // Daftar semua link
  if (req.method === "GET" && !code) {
    const { blobs } = await store.list();
    const items = await Promise.all(
      blobs.map(async ({ key }) => {
        const d = await store.get(key, { type: "json" });
        return d ? { code: key, ...d } : null;
      })
    );
    items.sort((a, b) => (b?.created || 0) - (a?.created || 0));
    return json({ links: items.filter(Boolean) });
  }

  // Buat link baru
  if (req.method === "POST" && !code) {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Data tidak valid." }, 400); }
    const url = cleanUrl(body.url);
    if (!url) return json({ error: "Alamat web tidak valid. Contoh: https://contoh.com/halaman" }, 400);

    let wanted = String(body.code || "").trim();
    if (wanted) {
      if (!/^[A-Za-z0-9_-]{2,40}$/.test(wanted))
        return json({ error: "Kode hanya boleh huruf, angka, - dan _ (2–40 karakter)." }, 400);
      if (RESERVED.has(wanted.toLowerCase())) return json({ error: "Kode itu tidak boleh dipakai." }, 400);
      if (await store.get(wanted)) return json({ error: `Kode "${wanted}" sudah dipakai.` }, 409);
    } else {
      for (let i = 0; i < 10; i++) {
        const c = randomCode();
        if (!(await store.get(c))) { wanted = c; break; }
      }
      if (!wanted) return json({ error: "Gagal membuat kode, coba lagi." }, 500);
    }

    const data = { url, clicks: 0, created: Date.now(), note: String(body.note || "").slice(0, 120) };
    await store.setJSON(wanted, data);
    return json({ code: wanted, ...data }, 201);
  }

  // Hapus link
  if (req.method === "DELETE" && code) {
    await store.delete(code);
    return json({ ok: true });
  }

  return json({ error: "Perintah tidak dikenal." }, 405);
};

export const config = { path: ["/api/links", "/api/links/:code"] };
