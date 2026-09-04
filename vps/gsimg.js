/* Genshin Impact: rasm + guruh + plitka
   node gsimg.js         -> faqat ko'rsatadi, hech narsa yozmaydi
   node gsimg.js --yes   -> zaxira olib yozadi

   Ro'yxatda yo'q paketlar YOPILADI (off = true).
   Genshin da bitta kategoriya bor: genshin_impact_global
*/
const fs    = require("fs");
const FILE  = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/genshin-x16.webp";

/* oid -> rasm raqami */
const IMG = {
  "60_genesis_crystals":        "x17",
  "300_30_genesis_crystals":    "x2",
  "980_110_genesis_crystals":   "x3",
  "1980_260_genesis_crystals":  "x5",
  "3280_600_genesis_crystals":  "x6",
  "6480_1600_genesis_crystals": "x13",

  "60_chronal_nexus":        "x12",
  "300_30_chronal_nexus":    "x14",
  "980_110_chronal_nexus":   "x7",
  "1980_260_chronal_nexus":  "x10",
  "3280_600_chronal_nexus":  "x8",
  "6480_1600_chronal_nexus": "x9",

  /* OID TAXMINIY - quruq ishga tushirish aniqlaydi */
  "blessing_of_the_welkin_moon": "x15"
};

function grpOf(oid){
  if(/_genesis_crystals$/.test(oid)) return { n:1, g:"Genesis Crystals" };
  if(/_chronal_nexus$/.test(oid))    return { n:2, g:"Chronal Nexus" };
  return { n:3, g:"Maxsus takliflar" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){
  return (x.cats || []).some(function(c){ return c.cat === "genshin_impact_global"; });
});
if(!g){ console.log("genshin_impact_global topilmadi"); process.exit(1); }
console.log("O'YIN: " + g.name + "  (id: " + g.id + ")");

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const badoid = [], used = {};
let hid = 0, opened = 0;

(g.cats || []).forEach(function(c){
  if(c.cat !== "genshin_impact_global") return;
  console.log("\n=== " + c.cat + " ===");

  const have = {};
  (c.offers || []).forEach(function(o){ have[o.oid] = 1; });
  Object.keys(IMG).forEach(function(oid){
    if(!have[oid]) badoid.push(c.cat + " / " + oid);
  });

  (c.offers || []).forEach(function(o,i){ o.__i = i; });
  c.offers.sort(function(a,b){
    const x = grpOf(a.oid), y = grpOf(b.oid);
    if(x.n !== y.n) return x.n - y.n;
    if(x.n !== 3)   return num(a.oid) - num(b.oid);
    return a.__i - b.__i;
  });

  let last = null;
  c.offers.forEach(function(o){
    const keep = !!IMG[o.oid];
    if(!keep){
      if(!o.off){ hid++; console.log("  YOPILADI: " + o.name); }
      if(APPLY) o.off = true;
      delete o.__i; return;
    }
    if(o.off){ opened++; console.log("  OCHILADI: " + o.name); }
    const im = "/genshin-" + IMG[o.oid] + ".webp";
    if(APPLY){
      o.off = false;
      o.im  = im;
      o.grp = grpOf(o.oid).g;
    }
    delete o.__i;
    used[im] = 1;
    const gg = grpOf(o.oid);
    if(gg.g !== last){ console.log("  [" + gg.g + "]"); last = gg.g; }
    console.log("    " + o.name.padEnd(30) + " <- " + im);
  });
});

if(badoid.length){
  console.log("\n!!! KATALOGDA TOPILMAGAN OID ---");
  badoid.forEach(function(x){ console.log("  " + x); });
}

const all = Object.keys(IMG).map(function(k){ return "/genshin-" + IMG[k] + ".webp"; });
const unused = all.filter(function(f){ return !used[f]; });
if(unused.length) console.log("\nISHLATILMAGAN: " + unused.join(", "));

console.log("\nYangi yopilgan: " + hid + " | qayta ochilgan: " + opened);

if(APPLY && !badoid.length){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("YOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else if(APPLY){
  console.log("YOZILMADI - avval topilmagan oid larni tuzatish kerak.");
} else {
  console.log("Hech narsa o'zgartirilmadi. Rozi bo'lsangiz: node gsimg.js --yes");
}
