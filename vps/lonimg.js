/* Legend of Neverland: rasm + nom + yopish + bo'limlar
   node lonimg.js         -> faqat ko'rsatadi
   node lonimg.js --yes   -> zaxira olib yozadi

   Nomlar o'yin do'konidagidek qilinadi, mijoz adashmasin.
   Ro'yxatda yo'q paketlar YOPILADI.
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/neverland-x62.png";

/* oid -> [global rasm, naeu rasm] */
const IMG = {
  "120_cabala_crystals":  ["x2","x32"],
  "300_cabala_crystals":  ["x9","x33"],
  "600_cabala_crystals":  ["x3","x34"],
  "1200_cabala_crystals": ["x4","x35"],
  "3000_cabala_crystals": ["x10","x36"],
  "6000_cabala_crystals": ["x5","x37"],

  "moon_blessing":   ["x6","x38"],
  "star_guard":      ["x7","x39"],
  "privilege_pack":  ["x8","x40"],
  "monthly_pack_ii": ["x12","x42"],
  "superb_flower_fairy_sale_pack": ["x13","x43"],
  "growth_pack":     ["x14","x44"],
  "fighter_pack":    ["x15","x45"],
  "candock_wish_pack": ["x16","x46"],
  "premium_flower_fairy_pack": ["x17","x47"],
  "fantasy_beast_cultivation_pack": ["x18","x48"],
  "sakura_pack":      ["x19","x49"],
  "monthly_pack_iii": ["x20","x50"],
  "weekly_limited_pack": ["x21","x51"],
  "flower_fairy_exp_pack": ["x22","x52"],
  "rename_card":      ["x23","x53"],
  "flower_fairy_accessory_pack": ["x24","x54"],
  "fantasy_beast_summoning_pack": ["x25","x55"],
  "monthly_limited_pack": ["x26","x56"],
  "cabala_crystal_investment_weekly_card": ["x27","x57"],
  "flower_fairy_link_weekly_card": ["x28","x58"],
  "sapphire_investment_weekly_card": ["x29","x59"],
  "flower_fairy_progress_weekly_card": ["x30","x60"],
  "path_of_fire_sword_battle_pass": ["x31","x61"]
};

/* o'yin do'konidagi haqiqiy nomlar */
const RENAME = {
  "growth_pack":                  "Boost Pack",
  "fighter_pack":                 "Warrior's Pack",
  "premium_flower_fairy_pack":    "Super-valued Flower Fairy Box",
  "monthly_pack_ii":              "Monthly Card Pack II",
  "monthly_pack_iii":             "Monthly Card Pack III",
  "rename_card":                  "Change Name Card",
  "flower_fairy_link_weekly_card":"Flower Fairy Summon Weekly Card",
  "flower_fairy_exp_pack":        "Flower Fairy EXP Box",
  "flower_fairy_accessory_pack":  "Flower Fairy Accessory Box",
  "fantasy_beast_summoning_pack": "Fantasy Beast Summon Pack"
};

const CARDS = ["cabala_crystal_investment_weekly_card","flower_fairy_link_weekly_card",
               "sapphire_investment_weekly_card","flower_fairy_progress_weekly_card",
               "monthly_pack_ii","monthly_pack_iii","moon_blessing","star_guard",
               "privilege_pack","path_of_fire_sword_battle_pass"];

function grpOf(oid){
  if(/_cabala_crystals$/.test(oid)) return { n:1, g:"Cabala Crystals" };
  if(CARDS.indexOf(oid) > -1)       return { n:2, g:"Obunalar kartasi" };
  return { n:3, g:"Maxsus takliflar" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "legendofneverland"; });
if(!g){ console.log("legendofneverland topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const badoid = [], used = {};
let hid = 0, opened = 0;

(g.cats || []).forEach(function(c, ci){
  console.log("\n=== " + c.cat + " ===");
  const idx = ci === 0 ? 0 : 1;

  const have = {};
  (c.offers || []).forEach(function(o){ have[o.oid] = 1; });
  Object.keys(IMG).forEach(function(oid){
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
    const keep = !!IMG[o.oid];
    if(!keep){
      if(!o.off){ hid++; console.log("  YOPILADI: " + o.name); }
      if(APPLY) o.off = true;
      delete o.__i; return;
    }
    if(o.off){ opened++; console.log("  OCHILADI: " + o.name); }
    const im = "/neverland-" + IMG[o.oid][idx] + ".webp";
    if(APPLY){
      o.off = false;
      o.im  = im;
      o.grp = grpOf(o.oid).g;
      if(RENAME[o.oid]) o.name = RENAME[o.oid];
    }
    delete o.__i;
    used[im] = 1;
    const gg = grpOf(o.oid);
    if(gg.g !== last){ console.log("  [" + gg.g + "]"); last = gg.g; }
    const nm = RENAME[o.oid] || o.name;
    console.log("    " + nm.padEnd(36) + " <- " + im);
  });
});

if(badoid.length){
  console.log("\n!!! KATALOGDA TOPILMAGAN OID ---");
  badoid.forEach(function(x){ console.log("  " + x); });
}
const all = [];
for(let i=2;i<=61;i++){ if(i!==11 && i!==41) all.push("/neverland-x"+i+".webp"); }
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
  console.log("YOZILMADI — avval topilmagan oid larni tuzatish kerak.");
} else {
  console.log("Hech narsa o'zgartirilmadi. Rozi bo'lsangiz: node lonimg.js --yes");
}
