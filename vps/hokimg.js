/* Honor of Kings: rasm + nom + bo'limlar
   node hokimg.js         -> faqat ko'rsatadi
   node hokimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/honor-x17.jpeg";

const IMG = {
  "80_tokens":   "/honor-x5.png",
  "240_tokens":  "/honor-x4.png",
  "400_tokens":  "/honor-x8.png",
  "560_tokens":  "/honor-x9.png",
  "830_tokens":  "/honor-x3.png",
  "1245_tokens": "/honor-x1.png",
  "2508_tokens": "/honor-x6.png",
  "4180_tokens": "/honor-x2.png",
  "8360_tokens": "/honor-x7.png",

  "weekly_card":      "/honor-x14.png",
  "weekly_card_plus": "/honor-x15.png",

  "double_token_lucky_bag":       "/honor-x10.png",
  "honor_point_value_pack":       "/honor-x12.png",
  "standard_purchase_rebate_pack":"/honor-x13.png",
  "premium_purchase_rebate_pack": "/honor-x16.png"
};

/* tushunarsiz nomni aniqroq qilamiz */
const RENAME = {
  "double_token_lucky_bag": "Lucky Bag (60-888 token)"
};

const SUBS = ["weekly_card","weekly_card_plus"];

function grpOf(oid){
  if(/_tokens$/.test(oid))    return { n:1, g:"Tokenlar" };
  if(SUBS.indexOf(oid) > -1)  return { n:2, g:"Obunalar kartasi" };
  return { n:3, g:"Maxsus takliflar" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "honorofkings"; });
if(!g){ console.log("honorofkings topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], used = {};
(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");

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
      if(IMG[o.oid])    o.im   = IMG[o.oid];
      if(RENAME[o.oid]) o.name = RENAME[o.oid];
    }
    delete o.__i;
    if(o.off) return;
    const gg = grpOf(o.oid);
    if(gg.g !== last){ console.log("  [" + gg.g + "]"); last = gg.g; }
    const im = IMG[o.oid] || "";
    const nm = RENAME[o.oid] || o.name;
    if(im) used[im] = 1; else noimg.push(o.name);
    console.log("    " + nm.padEnd(30) + " <- " + (im || "RASM YO'Q"));
  });
});

if(noimg.length){
  console.log("\n--- RASMSIZ QOLGAN ---");
  noimg.forEach(function(x){ console.log("  " + x); });
}
const all = [];
for(let i=1;i<=16;i++){ if(i!==11) all.push("/honor-x"+i+".png"); }
const unused = all.filter(function(f){ return !used[f]; });
if(unused.length) console.log("\nISHLATILMAGAN: " + unused.join(", "));

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node hokimg.js --yes");
}
