/* kim.js — bitta mijoz haqida to'liq ma'lumot.
   Ishlatilishi:  node kim.js @username
                  node kim.js 8364461786
   FAQAT O'QIYDI. data.json ga hech nima yozmaydi, o'zgartirmaydi. */

const fs = require("fs");
const DB = process.env.KIM_DB || "/root/donate-app/data.json";

const arg = String(process.argv[2] || "").trim();
if (!arg) {
  console.log("Ishlatilishi:\n  node kim.js @username\n  node kim.js 8364461786");
  process.exit(0);
}

let db;
try {
  db = JSON.parse(fs.readFileSync(DB, "utf8"));
} catch (e) {
  console.log("XATO: " + DB + " o'qilmadi — " + e.message);
  process.exit(1);
}

/* ---- qidirish: avval ID, keyin username ---- */
const q = arg.replace(/^@/, "").toLowerCase();
let id = "";
if (/^\d+$/.test(q) && db[q]) id = q;
if (!id) {
  for (const k in db) {
    const x = db[k];
    if (!x || typeof x !== "object") continue;
    if (String(x.un || "").toLowerCase() === q) { id = k; break; }
  }
}
if (!id) {
  console.log("❌ \"" + arg + "\" topilmadi.");
  console.log("Sabab: bu odam hali botga kirmagan, yoki username i o'zgargan.");
  console.log("Buyurtma xabaridagi \"id: ...\" raqami bilan urinib ko'ring.");
  process.exit(0);
}

const u = db[id];
const orders = Array.isArray(u.orders) ? u.orders : [];
const topups = Array.isArray(u.topups) ? u.topups : [];
const refs = Array.isArray(u.refs) ? u.refs : [];

function num(n) { return Number(n || 0).toLocaleString("ru-RU"); }
function dt(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return String(s);
  const p = (x) => String(x).padStart(2, "0");
  return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
         " " + p(d.getHours()) + ":" + p(d.getMinutes());
}
function nick(k) {
  const x = db[k];
  if (!x) return "id " + k;
  return (x.nm || "-") + (x.un ? " (@" + x.un + ")" : "") + " · id " + k;
}

/* ---- 1. Shaxs ---- */
console.log("\n════════════════════════════════════════");
console.log("👤 " + (u.nm || "-") + (u.un ? "  (@" + u.un + ")" : ""));
console.log("   id: " + id);
console.log("   📱 telefon: " + (u.phone ? u.phone : "ulanmagan"));
console.log("   🤖 botda start: " + (u.greeted ? "bosgan" : "YO'Q"));
console.log("   📅 birinchi kirgan: " + dt(u.firstAt));
console.log("════════════════════════════════════════");

/* ---- 2. Balans va pul ---- */
const spent = orders.filter(o => o.status !== "fail").reduce((s, o) => s + Number(o.price || 0), 0);
const filled = topups.filter(t => t.status === "ok").reduce((s, t) => s + Number(t.amount || 0), 0);
console.log("\n💰 BALANS: " + num(u.balance) + " so'm");
console.log("   Jami to'ldirgan: " + num(filled) + " so'm  (" + topups.length + " marta)");
console.log("   Jami sarflagan:  " + num(spent) + " so'm");

/* ---- 3. Buyurtmalar ---- */
const ok = orders.filter(o => o.status === "ok" || o.status === "done").length;
const wait = orders.filter(o => o.status === "wait").length;
const fail = orders.filter(o => o.status === "fail").length;
console.log("\n🧾 BUYURTMALAR: " + orders.length + " ta");
console.log("   ✅ bajarilgan: " + ok + "   ⏳ kutmoqda: " + wait + "   ❌ bekor: " + fail);
orders.slice(0, 5).forEach(function (o) {
  console.log("   • " + dt(o.at) + " — " + (o.game || "-") + " / " + (o.package || "-") +
              " — " + num(o.price) + " so'm [" + (o.status || "-") + "]" +
              (o.pid ? "  id:" + o.pid : ""));
});
if (orders.length > 5) console.log("   ... yana " + (orders.length - 5) + " ta");

/* ---- 4. Referal ---- */
const active = refs.filter(k => db[k] && (db[k].orders || []).length).length;
console.log("\n👥 TAKLIF QILGAN: " + refs.length + " ta odam");
console.log("   Ulardan buyurtma bergani: " + active + " ta");
refs.slice(0, 15).forEach(function (k, i) {
  const x = db[k] || {};
  const n = (x.orders || []).length;
  console.log("   " + (i + 1) + ". " + nick(k) + " — " + n + " buyurtma, balans " + num(x.balance));
});
if (refs.length > 15) console.log("   ... yana " + (refs.length - 15) + " ta");

console.log("\n🔗 O'ZINI KIM QO'SHGAN: " + (u.refBy ? nick(u.refBy) : "hech kim (o'zi kelgan)"));
console.log("");
