/* Blood Strike: paketlarni bo'limga ajratadi va nomlarni tuzatadi.
     51 BC   -> 51 Bc      (Gold bo'limi)
     0.99 DEAL -> 0.99 Deal (Deal bo'limi)
     Season Pass          (Obunalar kartasi)

   node bsgrp.js         -> faqat ko'rsatadi
   node bsgrp.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const SUBS = ["season_pass","lucky_bag_week","strike_pass_elite","strike_pass_premium",
              "level_up_pass","enable_cornucopia","ultra_skin_lucky_chest",
              "bloodstrike_pre_order_item"];

/* bo'lim tartibi: raqami kichigi tepada turadi */
function grpOf(oid){
  if(/_deal$/.test(oid))            return { n:2, g:"Deal" };
  if(SUBS.indexOf(oid) > -1)        return { n:3, g:"Obunalar kartasi" };
  if(/_bc$|_gold$/.test(oid))       return { n:1, g:"Gold" };
  return { n:4, g:"" };
}

/* KATTA harfni Bosh harfga: "51 BC" -> "51 Bc", "0.99 DEAL" -> "0.99 Deal" */
function fixName(s){
  return String(s).replace(/\b[A-Z]{2,}\b/g, function(w){
    return w.charAt(0) + w.slice(1).toLowerCase();
  });
}

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "bloodstrike"; });
if(!g){ console.log("bloodstrike topilmadi"); process.exit(1); }

(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  /* bo'lim bo'yicha saralaymiz, ichida esa asl tartib saqlanadi */
  (c.offers || []).forEach(function(o,i){ o.__i = i; });
  c.offers.sort(function(a,b){
    const x = grpOf(a.oid), y = grpOf(b.oid);
    return x.n !== y.n ? x.n - y.n : a.__i - b.__i;
  });

  let last = null;
  c.offers.forEach(function(o){
    const gg = grpOf(o.oid);
    const nn = fixName(o.name);
    if(gg.g !== last){ console.log("  [" + (gg.g || "—") + "]"); last = gg.g; }
    console.log("    " + o.name.padEnd(22) + (nn !== o.name ? " -> " + nn : "") +
                (o.off ? "   (yopiq)" : ""));
    if(APPLY){ o.grp = gg.g; o.name = nn; }
    delete o.__i;
  });
});

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node bsgrp.js --yes");
}
