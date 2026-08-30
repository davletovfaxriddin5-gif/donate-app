/* Rainbow Six Mobile: rasm + yopish + bo'limlar
   node r6img.js         -> faqat ko'rsatadi
   node r6img.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/rainbow-x75.jpg";

/* Global va SG da ikki xil variant bor — takrorini yopamiz */
const HIDE_ALL = ["7250_platinum","11250_platinum"];
const HIDE_DUP = ["250_first_purchase_only","600_first_purchase_only",
                  "2700_first_purchase_only","7000_first_purchase_only"];
const DUALCAT = ["r6_mobile_global","r6_mobile_sg"];

/* Global: rasm raqamlari aralash */
const GLOBAL = {
  "50_platinum":   "x1",
  "110_platinum":  "x12",
  "300_platinum":  "x13",
  "650_platinum":  "x14",
  "1350_platinum": "x5",
  "3500_platinum": "x9",
  "250_first_purchase":  "x3",
  "600_first_purchase":  "x4",
  "2700_first_purchase": "x8",
  "7000_first_purchase": "x11"
};

/* Qolganlarida tartib bir xil: 50,110,250FP,300,600FP,650,1350,2700FP,3500,7000FP */
const ORDER_ONLY = ["50_platinum","110_platinum","250_first_purchase_only","300_platinum",
                    "600_first_purchase_only","650_platinum","1350_platinum",
                    "2700_first_purchase_only","3500_platinum","7000_first_purchase_only"];
const ORDER_DUAL = ["50_platinum","110_platinum","250_first_purchase","300_platinum",
                    "600_first_purchase","650_platinum","1350_platinum",
                    "2700_first_purchase","3500_platinum","7000_first_purchase"];

function seq(start, oids){
  const m = {};
  oids.forEach(function(oid,i){ m[oid] = "x" + (start + i); });
  return m;
}

const IMG = {
  r6_mobile_global: GLOBAL,
  r6_mobile_id: seq(15, ORDER_ONLY),
  r6_mobile_my: seq(25, ORDER_ONLY),
  r6_mobile_ph: seq(35, ORDER_ONLY),
  r6_mobile_sg: seq(45, ORDER_DUAL),
  r6_mobile_th: seq(55, ORDER_ONLY),
  r6_mobile_us: seq(65, ORDER_ONLY)
};

function grpOf(oid){
  if(/_platinum$/.test(oid)) return { n:1, g:"Platinum" };
  return { n:2, g:"Birinchi xarid" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "rainbowsixmobile"; });
if(!g){ console.log("rainbowsixmobile topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], badoid = [], used = {};
let hid = 0;

(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  const map  = IMG[c.cat] || {};
  const hide = HIDE_ALL.concat(DUALCAT.indexOf(c.cat) > -1 ? HIDE_DUP : []);

  const have = {};
  (c.offers || []).forEach(function(o){ have[o.oid] = 1; });
  Object.keys(map).forEach(function(oid){
    if(!have[oid]) badoid.push(c.cat + " / " + oid);
  });

  (c.offers || []).forEach(function(o,i){ o.__i = i; });
  c.offers.sort(function(a,b){
    const x = grpOf(a.oid), y = grpOf(b.oid);
    if(x.n !== y.n) return x.n - y.n;
    return num(a.oid) - num(b.oid);
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
      if(map[o.oid]) o.im = "/rainbow-" + map[o.oid] + ".webp";
    }
    delete o.__i;
    if(o.off) return;
    const gg = grpOf(o.oid);
    if(gg.g !== last){ console.log("  [" + gg.g + "]"); last = gg.g; }
    const im = map[o.oid] ? "/rainbow-" + map[o.oid] + ".webp" : "";
    if(im) used[im] = 1; else noimg.push(c.cat + " / " + o.name);
    console.log("    " + o.name.padEnd(28) + " <- " + (im || "RASM YO'Q"));
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
  console.log("Hech narsa o'zgartirilmadi. Rozi bo'lsangiz: node r6img.js --yes");
}
