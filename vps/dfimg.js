/* Delta Force: rasm + bo'limlar
   node dfimg.js         -> faqat ko'rsatadi
   node dfimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/delta-x7.jpeg";

const IMG = {
  delta_force: {
    "30_delta_coins":   "/delta-x1.png",
    "60_delta_coins":   "/delta-x9.png",
    "320_delta_coins":  "/delta-x2.png",
    "460_delta_coins":  "/delta-x10.png",
    "750_delta_coins":  "/delta-x8.png",
    "1480_delta_coins": "/delta-x11.png",
    "1980_delta_coins": "/delta-x3.png",
    "3950_delta_coins": "/delta-x5.png",
    "8100_delta_coins": "/delta-x6.png",
    "season_pass_operations_special":  "/delta-x12.png",
    "season_pass_warfare_special":     "/delta-x13.png",
    "season_pass_delta_force_deluxe":  "/delta-x14.png"
  },
  garena_delta_force_indonesia: {
    "32_delta_coins":   "/delta-x15.png",
    "63_delta_coins":   "/delta-x16.png",
    "336_delta_coins":  "/delta-x17.png",
    "482_delta_coins":  "/delta-x18.png",
    "785_delta_coins":  "/delta-x19.png",
    "1544_delta_coins": "/delta-x20.png",
    "2065_delta_coins": "/delta-x21.png",
    "4114_delta_coins": "/delta-x22.png",
    "8424_delta_coins": "/delta-x23.png"
  },
  garena_delta_force_my: {
    "32_delta_coins":   "/delta-x24.png",
    "63_delta_coins":   "/delta-x25.png",
    "336_delta_coins":  "/delta-x26.png",
    "785_delta_coins":  "/delta-x27.png",
    "482_delta_coins":  "/delta-x28.png",
    "1544_delta_coins": "/delta-x29.png",
    "2065_delta_coins": "/delta-x30.png",
    "4114_delta_coins": "/delta-x31.png",
    "8424_delta_coins": "/delta-x32.png",
    "silent_sentinel_supplies_advanced": "/delta-x33.png",
    "black_hawk_down_genesis":           "/delta-x34.png",
    "black_hawk_down_reshape":           "/delta-x35.png",
    "silent_sentinel_supplies":          "/delta-x36.png"
  }
};

function grpOf(oid){
  if(/_delta_coins$/.test(oid))  return { n:1, g:"Delta Coins" };
  if(/^season_pass/.test(oid))   return { n:2, g:"Season Pass" };
  return { n:3, g:"Maxsus takliflar" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "deltaforce"; });
if(!g){ console.log("deltaforce topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], used = {};
(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  const map = IMG[c.cat] || {};

  (c.offers || []).forEach(function(o,i){ o.__i = i; });
  c.offers.sort(function(a,b){
    const x = grpOf(a.oid), y = grpOf(b.oid);
    if(x.n !== y.n) return x.n - y.n;
    if(x.n === 1)   return num(a.oid) - num(b.oid);
    return a.__i - b.__i;
  });

  let last = null;
  c.offers.forEach(function(o){
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
    console.log("    " + o.name.padEnd(36) + " <- " + (im || "RASM YO'Q"));
  });
});

if(noimg.length){
  console.log("\n--- RASMSIZ QOLGAN ---");
  noimg.forEach(function(x){ console.log("  " + x); });
}
const all = [];
for(let i=1;i<=36;i++){ if(i!==4 && i!==7) all.push("/delta-x"+i+".png"); }
const unused = all.filter(function(f){ return !used[f]; });
if(unused.length) console.log("\nISHLATILMAGAN: " + unused.join(", "));

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node dfimg.js --yes");
}
