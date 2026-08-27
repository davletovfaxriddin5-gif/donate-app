/* Blood Strike rasmlari -> games.json
   node bsimg.js         -> faqat ko'rsatadi
   node bsimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/g-bloodstrike-x7.png";           /* o'yin plitkasi */

/* MENA — GOLD paketlari */
const GOLD = {
  "51_gold":   "/g-bloodstrike-x1.png",
  "105_gold":  "/g-bloodstrike-x2.png",
  "320_gold":  "/g-bloodstrike-x3.png",
  "540_gold":  "/g-bloodstrike-x8.png",
  "1100_gold": "/g-bloodstrike-x4.png",
  "2260_gold": "/g-bloodstrike-x9.png",
  "5800_gold": "/g-bloodstrike-x5.png"
};

/* Global — BC paketlari (bc-x1 faqat eng kattasiga) */
const BC = {
  "51_bc":   "/bc-x2.png",
  "105_bc":  "/bc-x3.png",
  "320_bc":  "/bc-x4.png",
  "540_bc":  "/bc-x5.png",
  "1100_bc": "/bc-x6.png",
  "2260_bc": "/bc-x7.png",
  "5800_bc": "/bc-x1.png"
};

/* Ikkala kategoriyada ham bir xil */
const PASS = {
  "lucky_bag_week":      "/g-blood-x1.png",
  "season_pass":         "/g-blood-x2.png",
  "strike_pass_elite":   "/g-blood-x3.png",
  "strike_pass_premium": "/g-blood-x4.png"
};

/* DEAL: arzondan qimmatga qarab. Global 1-10, MENA 11-20 */
const DEAL_ORDER = ["0_99_deal","1_99_deal","2_99_deal","3_99_deal","4_99_deal",
                    "5_99_deal","6_99_deal","7_99_deal","8_99_deal","9_99_deal"];
const DEAL = { blood_strike:{}, blood_strike_mena:{} };
DEAL_ORDER.forEach(function(oid,i){
  DEAL.blood_strike[oid]      = "/deal-x" + (i+1)  + ".png";
  DEAL.blood_strike_mena[oid] = "/deal-x" + (i+11) + ".png";
});

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "bloodstrike"; });
if(!g){ console.log("bloodstrike topilmadi"); process.exit(1); }

let set = 0, miss = [];
if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  (c.offers || []).forEach(function(o){
    const im = GOLD[o.oid] || BC[o.oid] || PASS[o.oid] || (DEAL[c.cat] || {})[o.oid] || "";
    if(im){
      if(APPLY) o.im = im;
      set++;
      console.log("  " + o.name.padEnd(24) + " <- " + im + (o.off ? "   (yopiq)" : ""));
    } else if(!o.off){
      miss.push(c.cat + " / " + o.name);
    }
  });
});

if(miss.length){
  console.log("\n--- RASMSIZ QOLGAN (ko'rinadigan paketlar) ---");
  miss.forEach(function(x){ console.log("  " + x); });
}
console.log("\nJami bog'landi: " + set);

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("YOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("Hech narsa o'zgartirilmadi. Rozi bo'lsangiz: node bsimg.js --yes");
}
