/* Magic Chess Go Go: rasm + yopish + bo'limlar
   node magicimg.js         -> faqat ko'rsatadi
   node magicimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/magic-x2.png";

const IMG = {
  "22_diamonds":   "/magic-x19.png",
  "28_diamonds":   "/magic-x16.png",
  "56_diamonds":   "/magic-x20.png",
  "85_diamonds":   "/magic-x10.png",
  "165_diamonds":  "/magic-x11.png",
  "275_diamonds":  "/magic-x13.png",
  "344_diamonds":  "/magic-x21.png",
  "408_diamonds":  "/magic-x22.png",
  "565_diamonds":  "/magic-x8.png",
  "706_diamonds":  "/magic-x17.png",
  "875_diamonds":  "/magic-x23.png",
  "1163_diamonds": "/magic-x24.png",

  "first_recharge_100_50_50_bonus":     "/magic-x7.png",
  "first_recharge_300_150_150_bonus":   "/magic-x5.png",
  "first_recharge_500_250_250_bonus":   "/magic-x6.png",
  "first_recharge_1000_500_500_bonus":  "/magic-x18.png",

  "weekly_card":              "/magic-x14.png",
  "weekly_diamond_pass":      "/magic-x4.png",
  "battle_for_discounts":     "/magic-x1.png",
  "lukas_s_battle_bounty":    "/magic-x3.png",
  "lancelot_s_limited_time_gift": "/magic-x12.png"
};

/* faqat shu kategoriyada boshqa rasm */
const IMG_CAT = {
  magic_chess_gogo_global: { "565_diamonds": "/magic-x27.png" },
  magic_chess_gogo_ru:     { "55_diamonds":  "/magic-x26.png",
                             "1155_diamonds":"/magic-x25.png" }
};

/* 2x bonus nomlarini qisqartiramiz */
const RENAME = {
  "first_recharge_100_50_50_bonus":    "50+50",
  "first_recharge_300_150_150_bonus":  "150+150",
  "first_recharge_500_250_250_bonus":  "250+250",
  "first_recharge_1000_500_500_bonus": "500+500"
};

/* sotuvdan olinadiganlar */
const HIDE = {
  magic_chess_gogo_global: ["1346_diamonds","1825_diamonds","2195_diamonds","2398_diamonds",
                            "3688_diamonds","4830_diamonds","5532_diamonds","6042_diamonds",
                            "9288_diamonds"],
  magic_chess_gogo_ru:     ["1765_diamonds","2975_diamonds","6000_diamonds"]
};

const SUBS    = ["weekly_card","weekly_diamond_pass"];
const SPECIAL = ["battle_for_discounts","lukas_s_battle_bounty","lancelot_s_limited_time_gift"];

function grpOf(oid){
  if(/^first_recharge_/.test(oid))  return { n:1, g:"Birinchi to'ldirish 2x" };
  if(/_diamonds$/.test(oid))        return { n:2, g:"Olmoslar" };
  if(SUBS.indexOf(oid) > -1)        return { n:3, g:"Obunalar kartasi" };
  if(SPECIAL.indexOf(oid) > -1)     return { n:4, g:"Maxsus takliflar" };
  return { n:5, g:"" };
}
/* olmoslarni miqdori bo'yicha, qolganini asl tartibda */
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "magicchessgogo"; });
if(!g){ console.log("magicchessgogo topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], used = {};
(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  const hide = HIDE[c.cat] || [];

  (c.offers || []).forEach(function(o,i){ o.__i = i; });
  c.offers.sort(function(a,b){
    const x = grpOf(a.oid), y = grpOf(b.oid);
    if(x.n !== y.n) return x.n - y.n;
    if(x.n === 2)   return num(a.oid) - num(b.oid);
    return a.__i - b.__i;
  });

  let last = null;
  c.offers.forEach(function(o){
    const yop = o.off || hide.indexOf(o.oid) > -1;
    if(APPLY){
      if(hide.indexOf(o.oid) > -1) o.off = true;
      o.grp = grpOf(o.oid).g;
      const pick = (IMG_CAT[c.cat] || {})[o.oid] || IMG[o.oid];
      if(pick) o.im = pick;
      if(RENAME[o.oid]) o.name = RENAME[o.oid];
    }
    if(yop){
      if(hide.indexOf(o.oid) > -1) console.log("  YOPILADI: " + o.name);
      return;
    }
    const gg = grpOf(o.oid);
    if(gg.g !== last){ console.log("  [" + (gg.g || "—") + "]"); last = gg.g; }
    const im = (IMG_CAT[c.cat] || {})[o.oid] || IMG[o.oid] || "";
    const nm = RENAME[o.oid] || o.name;
    if(im) used[im] = 1; else noimg.push(c.cat + " / " + o.name);
    console.log("    " + nm.padEnd(34) + " <- " + (im || "RASM YO'Q"));
    delete o.__i;
  });
});

if(noimg.length){
  console.log("\n--- RASMSIZ QOLGAN ---");
  noimg.forEach(function(x){ console.log("  " + x); });
}
const all = [];
for(let i=1;i<=27;i++) all.push("/magic-x"+i+".png");
const unused = all.filter(function(f){ return f !== TILE && !used[f]; });
if(unused.length) console.log("\nISHLATILMAGAN RASM: " + unused.join(", "));

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node magicimg.js --yes");
}
