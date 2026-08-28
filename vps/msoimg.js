/* Modern Strike Online: rasm + bo'limlar
   node msoimg.js         -> faqat ko'rsatadi
   node msoimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/modern-x8.jpg";

const IMG = {
  "10000_gold":     "/modern-x1.webp",
  "16000_gold":     "/modern-x9.webp",
  "35000_gold":     "/modern-x10.webp",
  "60000_gold":     "/modern-x11.webp",
  "300000_gold":    "/modern-x12.webp",

  "10000_credits":  "/modern-x4.webp",
  "25000_credits":  "/modern-x13.webp",
  "55000_credits":  "/modern-x5.webp",
  "100000_credits": "/modern-x14.webp",

  "vip_7_days":     "/modern-x6.webp",
  "vip_14_days":    "/modern-x2.webp",
  "vip_30_days":    "/modern-x3.webp",
  "vip_60_days":    "/modern-x7.webp"
};

/* sotuvdan olinadi */
const HIDE = ["battle_pass_premium"];

function grpOf(oid){
  if(/_gold$/.test(oid))    return { n:1, g:"Gold" };
  if(/_credits$/.test(oid)) return { n:2, g:"Credits" };
  return { n:3, g:"Obunalar" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }
function vip(oid){ const m = oid.match(/vip_(\d+)_/); return m ? +m[1] : 999; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "modernstrikeonline"; });
if(!g){ console.log("modernstrikeonline topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], badoid = [], used = {};
(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");

  const have = {};
  (c.offers || []).forEach(function(o){ have[o.oid] = 1; });
  Object.keys(IMG).forEach(function(oid){ if(!have[oid]) badoid.push(oid); });

  (c.offers || []).forEach(function(o,i){ o.__i = i; });
  c.offers.sort(function(a,b){
    const x = grpOf(a.oid), y = grpOf(b.oid);
    if(x.n !== y.n) return x.n - y.n;
    if(x.n === 3)   return vip(a.oid) - vip(b.oid);
    return num(a.oid) - num(b.oid);
  });

  let last = null;
  c.offers.forEach(function(o){
    if(HIDE.indexOf(o.oid) > -1){
      if(APPLY) o.off = true;
      console.log("  YOPILADI: " + o.name);
      delete o.__i; return;
    }
    if(APPLY){
      o.grp = grpOf(o.oid).g;
      if(IMG[o.oid]) o.im = IMG[o.oid];
    }
    delete o.__i;
    if(o.off) return;
    const gg = grpOf(o.oid);
    if(gg.g !== last){ console.log("  [" + gg.g + "]"); last = gg.g; }
    const im = IMG[o.oid] || "";
    if(im) used[im] = 1; else noimg.push(o.name + "  (" + o.oid + ")");
    console.log("    " + o.name.padEnd(22) + " <- " + (im || "RASM YO'Q"));
  });
});

if(badoid.length){
  console.log("\n!!! KATALOGDA TOPILMAGAN OID ---");
  badoid.forEach(function(x){ console.log("  " + x); });
}
if(noimg.length){
  console.log("\n--- RASMSIZ QOLGAN ---");
  noimg.forEach(function(x){ console.log("  " + x); });
}

if(APPLY && !badoid.length){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else if(APPLY){
  console.log("\nYOZILMADI — avval topilmagan oid larni tuzatish kerak.");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node msoimg.js --yes");
}
