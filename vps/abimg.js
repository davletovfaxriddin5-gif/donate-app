/* Arena Breakout: rasm + yopish + bo'limlar
   node abimg.js         -> faqat ko'rsatadi
   node abimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/arenabreak-x13.jpeg";

const IMG = {
  arena_breakout: {
    "66_bonds":    "/arenabreak-x5.png",
    "335_bonds":   "/arenabreak-x4.png",
    "675_bonds":   "/arenabreak-x8.png",
    "1690_bonds":  "/arenabreak-x11.png",
    "3400_bonds":  "/arenabreak-x14.png",
    "6820_bonds":  "/arenabreak-x3.png",
    "beginner_select": "/arenabreak-x9.png",
    "monthly_advanced_battle_pass_activation_pass": "/arenabreak-x7.png",
    "monthly_premium_battle_pass_activation_pass":  "/arenabreak-x2.png",
    "quarterly_premium_battle_pass_bundle_activation_pass_bundle": "/arenabreak-x12.png",
    "bulletproof_case_privileges": "/arenabreak-x6.png",
    "bulletproof_case_30d":        "/arenabreak-x15.png",
    "composite_case_privileges":   "/arenabreak-x1.png",
    "composition_case_30d":        "/arenabreak-x16.png"
  },
  arena_breakout_infinite: {
    "100_bonds":   "/arenabreak-x17.png",
    "500_bonds":   "/arenabreak-x10.png",
    "1000_bonds":  "/arenabreak-x18.png",
    "2500_bonds":  "/arenabreak-x19.png",
    "5000_bonds":  "/arenabreak-x20.png",
    "10000_bonds": "/arenabreak-x21.png",
    "copper_works_skin_bundle_i":  "/arenabreak-x22.png",
    "copper_works_skin_bundle_ii": "/arenabreak-x22.png",
    "premium_battle_pass_activation_card": "/arenabreak-x23.png"
  }
};

const HIDE = {
  arena_breakout_infinite: ["classic_craftsmanship_skin_bundle_i",
                            "classic_craftsmanship_skin_bundle_ii"]
};

function grpOf(oid){
  if(/_bonds$/.test(oid))          return { n:1, g:"Bonds" };
  if(/battle_pass/.test(oid))      return { n:2, g:"Battle Pass" };
  if(/case/.test(oid))             return { n:3, g:"Case" };
  return { n:4, g:"Maxsus takliflar" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "arenabreakout"; });
if(!g){ console.log("arenabreakout topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], used = {};
(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  const hide = HIDE[c.cat] || [];
  const map  = IMG[c.cat] || {};

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
      if(APPLY) o.off = true;
      console.log("  YOPILADI: " + o.name);
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
    console.log("    " + o.name.slice(0,42).padEnd(44) + " <- " + (im || "RASM YO'Q"));
  });
});

if(noimg.length){
  console.log("\n--- RASMSIZ QOLGAN ---");
  noimg.forEach(function(x){ console.log("  " + x); });
}
const all = [];
for(let i=1;i<=23;i++) all.push("/arenabreak-x"+i+".png");
const unused = all.filter(function(f){ return !used[f]; });
if(unused.length) console.log("\nISHLATILMAGAN: " + unused.join(", "));

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node abimg.js --yes");
}
