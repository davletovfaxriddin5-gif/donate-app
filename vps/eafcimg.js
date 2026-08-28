/* EA FC Mobile: rasm + yopish + bo'limlar
   node eafcimg.js         -> faqat ko'rsatadi
   node eafcimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/mobile-x28.jpeg";

/* har regionda o'z rasmlari: [fc40,fc100,fc520,fc1070,fc2200,fc5750, s39,s99,s499,s999,s1999,s4999] */
const SET = {
  eafc_mobile_id: ["mobile-x1","mobile-x2","mobile-x4","mobile-x9","mobile-x7","mobile-x8",
                   "silver-x1","silver-x7","silver-x2","silver-x3","silver-x5","silver-x6"],
  eafc_mobile_kh: ["mobile-x10","mobile-x11","mobile-x12","mobile-x13","mobile-x14","mobile-x15",
                   "silver-x8","silver-x9","silver-x10","silver-x11","silver-x12","silver-x13"],
  eafc_mobile_my: ["mobile-x16","mobile-x17","mobile-x18","mobile-x19","mobile-x20","mobile-x21",
                   "silver-x14","silver-x15","silver-x16","silver-x17","silver-x18","silver-x19"],
  eafc_mobile_sg: ["mobile-x22","mobile-x23","mobile-x24","mobile-x25","mobile-x26","mobile-x27",
                   "silver-x20","silver-x21","silver-x22","silver-x23","silver-x24","silver-x25"]
};
const OIDS = ["40_fc_points","100_fc_points","520_fc_points","1070_fc_points",
              "2200_fc_points","5750_fc_points",
              "39_silver","99_silver","499_silver","999_silver","1999_silver","4999_silver"];

/* hamma regionda yopiladi */
const HIDE = ["12000_fc_points","9999_silver"];

function grpOf(oid){
  if(/_fc_points$/.test(oid)) return { n:1, g:"FC Points" };
  if(/_silver$/.test(oid))    return { n:2, g:"Silver" };
  return { n:3, g:"" };
}
function num(oid){ const m = oid.match(/^(\d+)_/); return m ? +m[1] : 0; }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "eafcmobile"; });
if(!g){ console.log("eafcmobile topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], badoid = [], used = {};
(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  const set = SET[c.cat];
  if(!set){ console.log("  (rasm ro'yxati yo'q)"); return; }

  const map = {};
  OIDS.forEach(function(oid,i){ map[oid] = "/" + set[i] + ".png"; });

  /* xarita ichidagi oid haqiqatan bormi? */
  const have = {};
  (c.offers || []).forEach(function(o){ have[o.oid] = 1; });
  OIDS.concat(HIDE).forEach(function(oid){
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
    if(HIDE.indexOf(o.oid) > -1){
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
    console.log("    " + o.name.padEnd(18) + " <- " + (im || "RASM YO'Q"));
  });
});

if(badoid.length){
  console.log("\n!!! KATALOGDA TOPILMAGAN OID ---");
  badoid.forEach(function(x){ console.log("  " + x); });
  console.log("  (nomlar boshqacha — menga ayting, xaritani tuzataman)");
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
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node eafcimg.js --yes");
}
