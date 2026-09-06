/* gitbackup.js — UCHINCHI ZAXIRA: data.json ni GitHub dagi YOPIQ repoga jo'natadi.
 *
 * Ishlatilishi:
 *   node gitbackup.js          -> bir marta jo'natadi va chiqadi (sinov uchun)
 *   node gitbackup.js --loop   -> har 30 daqiqada jo'natib turadi (pm2 uchun)
 *
 * .env da bo'lishi kerak:
 *   GH_TOKEN=github_pat_...
 *   GH_REPO=davletovfaxriddin5-gif/minatoh-backup
 *
 * HIMOYA: jo'natishdan oldin repo PRIVATE ekanini GitHub dan so'raydi.
 * Public bo'lsa — hech nima jo'natmaydi. .env hech qachon jo'natilmaydi. */

/* ---------- .env dan o'qish (server.js dagi kabi) ---------- */
try {
  const _t = require("fs").readFileSync("/root/donate-app/.env", "utf8");
  _t.split("\n").forEach(function (line) {
    const s = line.trim();
    if (!s || s[0] === "#") return;
    const i = s.indexOf("=");
    if (i < 1) return;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if (v.length > 1 && ((v[0] === '"' && v.slice(-1) === '"') || (v[0] === "'" && v.slice(-1) === "'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  });
} catch (e) {}

/* VPS da IPv6 muammosi bor — Node avval IPv4 ni sinasin */
try { require("dns").setDefaultResultOrder("ipv4first"); } catch (e) {}

const fs = require("fs");
const crypto = require("crypto");

const TOKEN = process.env.GH_TOKEN || "";
const REPO = process.env.GH_REPO || "";
const BRANCH = process.env.GH_BRANCH || "main";
const DB = process.env.KIM_DB || "/root/donate-app/data.json";
const HASHF = "/root/donate-app/.gitbackup-hash";
const EVERY_MIN = 30;

function log(msg) {
  const d = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log("[" + d + "] " + msg);
}

async function gh(path, opts) {
  const r = await fetch("https://api.github.com" + path, Object.assign({
    headers: {
      "Authorization": "Bearer " + TOKEN,
      "Accept": "application/vnd.github+json",
      "User-Agent": "minatoh-gitbackup",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  }, opts || {}));
  let body = null;
  try { body = await r.json(); } catch (e) {}
  return { status: r.status, body: body };
}

async function backup() {
  if (!TOKEN || !REPO) {
    log("XATO: .env da GH_TOKEN yoki GH_REPO yo'q. Zaxira o'tkazib yuborildi.");
    return false;
  }

  /* ---- 1. HIMOYA: repo rostdan PRIVATE mi? ---- */
  const info = await gh("/repos/" + REPO);
  if (info.status === 401) { log("XATO: token noto'g'ri yoki o'chirilgan (401)."); return false; }
  if (info.status === 404) { log("XATO: repo topilmadi yoki tokenda ruxsat yo'q (404): " + REPO); return false; }
  if (info.status !== 200 || !info.body) { log("XATO: GitHub javob bermadi (" + info.status + ")."); return false; }
  if (info.body.private !== true) {
    log("!!! TO'XTATILDI: " + REPO + " OCHIQ (public) repo. Mijoz ma'lumotlari jo'natilmadi.");
    log("!!! Reponi Settings -> Danger Zone orqali Private qiling.");
    return false;
  }

  /* ---- 2. Faylni o'qish ---- */
  let raw;
  try { raw = fs.readFileSync(DB, "utf8"); }
  catch (e) { log("XATO: " + DB + " o'qilmadi — " + e.message); return false; }

  try { JSON.parse(raw); }
  catch (e) { log("XATO: data.json buzuq JSON — buzuq nusxa jo'natilmadi."); return false; }

  /* ---- 3. O'zgarmagan bo'lsa jo'natmaymiz ---- */
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  let last = "";
  try { last = fs.readFileSync(HASHF, "utf8").trim(); } catch (e) {}
  if (hash === last) { log("o'zgarish yo'q — jo'natilmadi"); return true; }

  /* ---- 4. Repodagi eski faylning sha si ---- */
  const cur = await gh("/repos/" + REPO + "/contents/data.json?ref=" + BRANCH);
  const sha = (cur.status === 200 && cur.body && cur.body.sha) ? cur.body.sha : null;

  /* ---- 5. Jo'natish ---- */
  let users = 0, orders = 0;
  try {
    const d = JSON.parse(raw);
    for (const k in d) {
      const x = d[k];
      if (x && typeof x === "object" && Array.isArray(x.orders)) { users++; orders += x.orders.length; }
    }
  } catch (e) {}

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const msg = "backup " + stamp + " — " + users + " foydalanuvchi, " + orders + " buyurtma";
  const put = await gh("/repos/" + REPO + "/contents/data.json", {
    method: "PUT",
    body: JSON.stringify({
      message: msg,
      content: Buffer.from(raw, "utf8").toString("base64"),
      branch: BRANCH,
      sha: sha || undefined
    })
  });

  if (put.status === 200 || put.status === 201) {
    try { fs.writeFileSync(HASHF, hash); } catch (e) {}
    log("✅ zaxira jo'natildi — " + users + " foydalanuvchi, " + orders + " buyurtma, " +
        Math.round(raw.length / 1024) + " KB");
    return true;
  }
  log("XATO: jo'natilmadi (" + put.status + ") " + (put.body && put.body.message ? put.body.message : ""));
  return false;
}

/* ---- ishga tushirish ---- */
if (process.argv.indexOf("--loop") >= 0) {
  log("gitbackup ishga tushdi — har " + EVERY_MIN + " daqiqada, repo: " + REPO);
  backup();
  setInterval(backup, EVERY_MIN * 60 * 1000);
} else {
  backup().then(function (ok) { process.exit(ok ? 0 : 1); });
}
