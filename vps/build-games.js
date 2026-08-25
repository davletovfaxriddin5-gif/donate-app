/* fzr-offers.json dan narxlarni hisoblab, games.json yasaydi.
   Ishga tushirish:  cd /root/donate-app && node build-games.js
   Qayta narx qo'yish kerak bo'lsa \u2014 shu skriptni qayta ishga tushirish yetadi. */

const fs = require("fs");
const SRC = "/root/donate-app/fzr-offers.json";
const DST = "/root/donate-app/games.json";

/* ---------- NARX QOIDASI ----------
   Bufer kurs: dollar ko'tarilsa ham zarar bo'lmasligi uchun haqiqiy kursdan yuqori.
   Ustama bosqichli: kichik paketda foiz katta (aks holda foyda tiyin bo'lib qoladi),
   katta paketda kichik (aks holda raqobatbardosh bo'lmaydi). */
const UZS   = 12300;
const TIERS = [
  { upto:   20000, pct: 35, min: 1500 },
  { upto:  100000, pct: 20, min: 3000 },
  { upto:  500000, pct: 14, min: 8000 },
  { upto: Infinity, pct: 11, min: 30000 },
];
const STEP = 500;                      /* narx shunga yaxlitlanadi */

function sell(costUzs){
  let t = TIERS[TIERS.length-1];
  for(let i = 0; i < TIERS.length; i++) if(costUzs <= TIERS[i].upto){ t = TIERS[i]; break; }
  const add = Math.max(Math.round(costUzs * t.pct / 100), t.min);
  let p = Math.ceil((costUzs + add) / STEP) * STEP;
  if(p <= costUzs) p = Math.ceil((costUzs * 1.15) / STEP) * STEP;   /* himoya */
  return p;
}

/* ---------- yordamchilar ---------- */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/* "Valorant (ID)" -> "ID";  "Call of Duty Mobile - Activision (KZ)" -> "Activision KZ" */
function regionLabel(catId, catName, gameName){
  const m = String(catName || "").match(/\(([^)]+)\)\s*$/);
  let lab = m ? m[1] : "";
  const pre = String(catName || "").replace(/\s*\([^)]*\)\s*$/, "")
                .replace(new RegExp("^" + gameName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
                .replace(/^[\s\-:]+/, "").trim();
  if(pre && lab) lab = pre + " " + lab;
  else if(pre)  lab = pre;
  if(!lab){
    const tail = String(catId).split("_").pop();
    lab = tail.length <= 4 ? tail.toUpperCase() : "Global";
  }
  return lab;
}

/* ---------- asosiy ---------- */
const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
const out = { rate: UZS, at: new Date().toISOString(), games: [] };
let nOffers = 0, nCats = 0, warn = [];

Object.keys(src).forEach(function(gameName){
  const g = { id: slug(gameName), name: gameName, cats: [] };

  Object.keys(src[gameName]).forEach(function(catId){
    const c = src[gameName][catId];
    const cat = {
      cat:    catId,
      label:  regionLabel(catId, c.name, gameName),
      fields: (c.fields || []).map(function(f){
        const o = { key: f.key, label: f.label || f.key, type: f.type || "text" };
        if(f.type === "select") o.options = (f.options || []).map(function(x){
          return { label: x.label, value: x.value };
        });
        return o;
      }),
      offers: []
    };
    if(!cat.fields.length) warn.push(catId + " \u2014 maydon yo'q");

    (c.offers || []).forEach(function(o){
      const usd  = Number(o.price_usd) || 0;
      if(!(usd > 0)) return;
      const cost = Math.round(usd * UZS);
      const p    = sell(cost);
      cat.offers.push({ oid: o.offer_id, name: o.name, usd: usd, cost: cost, price: p });
      nOffers++;
    });

    if(cat.offers.length){ g.cats.push(cat); nCats++; }
  });

  if(g.cats.length) out.games.push(g);
});

fs.writeFileSync(DST, JSON.stringify(out));

/* ---------- hisobot ---------- */
console.log("=== TAYYOR ===");
console.log("o'yin: " + out.games.length + "   kategoriya: " + nCats + "   paket: " + nOffers);
console.log("fayl: games.json   kurs: " + UZS);
if(warn.length) console.log("\u26A0\uFE0F  " + warn.join("; "));

let minP = 100, worst = null;
out.games.forEach(function(g){ g.cats.forEach(function(c){ c.offers.forEach(function(o){
  const pct = (o.price - o.cost) / o.price * 100;
  if(pct < minP){ minP = pct; worst = g.name + " " + o.name; }
}); }); });
console.log("eng kichik foyda ulushi: " + minP.toFixed(1) + "%  (" + worst + ")");

console.log("\n=== NAMUNA NARXLAR ===");
const show = [["Valorant","475 VP"],["Genshin Impact","60"],["Call of Duty Mobile","80"],
              ["Blood Strike","51"],["Honor of Kings","16"],["Zenless Zone Zero","60"],
              ["Rainbow Six Mobile","50"],["Magic Chess Go Go","50"]];
show.forEach(function(s){
  const g = out.games.find(x => x.name === s[0]); if(!g) return;
  const c = g.cats[0];
  const o = c.offers.find(x => String(x.name).indexOf(s[1]) === 0) || c.offers[0];
  if(!o) return;
  console.log(("  " + g.name).padEnd(24) + String(o.name).padEnd(16) +
    ("$" + o.usd).padStart(9) + ("  tan " + o.cost).padStart(12) +
    ("  sot " + o.price).padStart(14) +
    ("  +" + Math.round((o.price - o.cost) / o.cost * 100) + "%").padStart(7));
});
console.log("\nO'yin ro'yxati:");
out.games.forEach(function(g){
  console.log("  " + g.id.padEnd(20) + g.cats.length + " region, " +
              g.cats.reduce((a,c)=>a+c.offers.length,0) + " paket");
});
