/* Garena Undawn: rasm + yopish + bo'limlar
   node udimg.js         -> faqat ko'rsatadi
   node udimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/undawn-x45.jpeg";

const IMG = {
  undawn_garena_global: {
    "101_rc":   "/undawn-x1.webp",
    "141_rc":   "/undawn-x14.webp",
    "203_rc":   "/undawn-x2.webp",
    "410_rc":   "/undawn-x3.webp",
    "615_rc":   "/undawn-x15.webp",
    "720_rc":   "/undawn-x16.webp",
    "825_rc":   "/undawn-x11.webp",
    "1040_rc":  "/undawn-x17.webp",
    "1465_rc":  "/undawn-x4.webp",
    "2095_rc":  "/undawn-x18.webp",
    "2950_rc":  "/undawn-x13.webp",
    "4240_rc":  "/undawn-x19.webp",
    "6480_rc":  "/undawn-x6.webp",
    "8710_rc":  "/undawn-x20.webp",
    "weekly_card":  "/undawn-x7.webp",
    "monthly_card": "/undawn-x9.webp",
    "growth_fund":  "/undawn-x10.webp",
    "ace_fund":     "/undawn-x12.webp",
    "elite_fund":   "/undawn-x8.webp"
  },
  undawn_garena_id: {
    "80_rc":     "/undawn-x21.webp",
    "250_rc":    "/undawn-x22.webp",
    "450_rc":    "/undawn-x23.webp",
    "920_rc":    "/undawn-x25.webp",
    "1_850_rc":  "/undawn-x26.webp",
    "2_800_rc":  "/undawn-x27.webp",
    "4_750_rc":  "/undawn-x28.webp",
    "9_600_rc":  "/undawn-x29.webp",
    "growth_fund": "/undawn-x24.webp"
  },
  undawn_garena_sg: {
    "148_rc":   "/undawn-x30.webp",
    "208_rc":   "/undawn-x31.webp",
    "298_rc":   "/undawn-x33.webp",
    "445_rc":   "/undawn-x34.webp",
    "1040_rc":  "/undawn-x38.webp",
    "1485_rc":  "/undawn-x40.webp",
    "2080_rc":  "/undawn-x41.webp",
    "2375_rc":  "/undawn-x42.webp",
    "4500_rc":  "/undawn-x43.webp",
    "7500_rc":  "/undawn-x44.webp",
    "weekly_card":  "/undawn-x32.webp",
    "monthly_card": "/undawn-x35.webp",
    "growth_fund":  "/undawn-x36.webp",
    "elite_fund":   "/undawn-x37.webp",
    "ace_fund":     "/undawn-x39.webp",
    "dragongate_knight": "/undawn-x46.jpeg"
  }
};

const HIDE = {
  undawn_garena_global: ["3175_rc","4250_rc","10890_rc"],
  undawn_garena_sg:     ["475_rc","520_rc","745_rc","2970_rc","battle_pass_premium"]
};

const CARDS = ["weekly_card","monthly_card"];
const FUNDS = ["growth_fund","ace_fund","elite_fund"];

function grpOf(oid){
  if(/_rc$/.test(oid))          return { n:1, g:"RC" };
  if(CARDS.indexOf(oid) > -1)   return { n:2, g:"Obunalar kartasi" };
  if(FUNDS.indexOf(oid) > -1)   return { n:3, g:"Fondlar" };
  return { n:4, g:"Maxsus takliflar" };
}
/* 1_850_rc -> 1850 */
function num(oid){
  const m = oid.match(/^([\d_]+)_rc$/);
  if(m) return +m[1].replace(/_/g,"");
  const m2 = oid.match(/^(\d+)_/);
  return m2 ? +m2[1] : 0;
}

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "undawn"; });
if(!g){ console.log("undawn topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], badoid = [], used = {};
let hid = 0;

(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  const map  = IMG[c.cat]  || {};
  const hide = HIDE[c.cat] || [];

  const have = {};
  (c.offers || []).forEach(function(o){ have[o.oid] = 1; });
  Object.keys(map).concat(hide).forEach(function(oid){
    if(!have[oid]) badoid.push(c.cat + " / " + oid);
  });

  (c.offers || []).forEach(function(o,i){ o.__i = i; });
  c.offers.sort(function(a,b){
    const x = grpOf(a.oid), y = grpOf(b.oid);
    if(x.n !== y.n) return x.n - y.n;
    if(x.n === 1)   return num(a.oid) - num(b.oid);
    return a.__i - b.__i;
  });

  let last = null;
  c.offers.forEach(function(o){
    if(hide.indexOf(o.oid) > -1){
      if(!o.off){ hid++; console.log("  YOPILADI: " + o.name); }
      if(APPLY) o.off = true;
      delete o.__i; return;
    }
    if(APPLY){
      o.grp = grpOf(o.oid).g;
      if(map[o.oid]) o.im = map[o.oid];
    }
    delete o.__i;
    if(o.off) return;
    const gg = grpOf(o.oid);
    if(gg.g !== last){ console.log("  [" + gg.g + "]"); last = gg.g; }
    const im = map[o.oid] || "";
    if(im) used[im] = 1; else noimg.push(c.cat + " / " + o.name);
    console.log("    " + o.name.padEnd(20) + " <- " + (im || "RASM YO'Q"));
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
console.log("\nYangi yopilgan: " + hid);

if(APPLY && !badoid.length){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("YOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else if(APPLY){
  console.log("YOZILMADI — avval topilmagan oid larni tuzatish kerak.");
} else {
  console.log("Hech narsa o'zgartirilmadi. Rozi bo'lsangiz: node udimg.js --yes");
}
