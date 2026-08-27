/* Call of Duty Mobile: rasm + yopish
   node codmimg.js         -> faqat ko'rsatadi
   node codmimg.js --yes   -> zaxira olib yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

const TILE = "/call-of-x8.jpeg";

/* Har bir kategoriyaning o'z rasmlari bor */
const IMG = {
  codm_activision_ca: {
    "88_cp":    "/call-of-x3.png",
    "460_cp":   "/call-of-x1.png",
    "960_cp":   "/call-of-x4.png",
    "2600_cp":  "/call-of-x5.png",
    "5400_cp":  "/call-of-x7.png",
    "11200_cp": "/call-of-x2.png"
  },
  codm_activision_in: {
    "88_cp":    "/call-of-x9.png",
    "460_cp":   "/call-of-x10.png",
    "960_cp":   "/call-of-x11.png",
    "2600_cp":  "/call-of-x12.png",
    "5400_cp":  "/call-of-x13.png",
    "11200_cp": "/call-of-x14.png"
  },
  codm_activision_kz: {
    "88_cp":    "/call-of-x15.png",
    "460_cp":   "/call-of-x16.png",
    "960_cp":   "/call-of-x17.png",
    "2600_cp":  "/call-of-x18.png",
    "5400_cp":  "/call-of-x19.png",
    "11600_cp": "/call-of-x20.png"
  },
  codm_activision_sa: {
    "88_cp":    "/call-of-x21.png",
    "460_cp":   "/call-of-x22.png",
    "960_cp":   "/call-of-x23.png",
    "2600_cp":  "/call-of-x24.png",
    "5400_cp":  "/call-of-x25.png",
    "11600_cp": "/call-of-x26.png"
  },
  codm_activision_us: {
    "88_cp":    "/call-of-x27.png",
    "460_cp":   "/call-of-x28.png",
    "960_cp":   "/call-of-x29.png",
    "2600_cp":  "/call-of-x30.png",
    "5400_cp":  "/call-of-x31.png",
    "11600_cp": "/call-of-x32.png"
  },
  codm_garena_sgmy: {
    "114_cp":  "/call-of-x33.png",
    "253_cp":  "/call-of-x34.png",
    "529_cp":  "/call-of-x35.png",
    "794_cp":  "/call-of-x36.png",
    "1053_cp": "/call-of-x37.png",
    "2760_cp": "/call-of-x38.png",
    "6440_cp": "/call-of-x39.png",
    "9200_cp": "/call-of-x40.png"
  }
};

/* sotuvdan olinadiganlar */
const HIDE = {
  codm_garena_sgmy: ["115_cp","1323_cp","9602_cp","12880_cp","15640_cp","16001_cp","19320_cp"]
};

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const g = (raw.games || []).find(function(x){ return x.id === "callofdutymobile"; });
if(!g){ console.log("callofdutymobile topilmadi"); process.exit(1); }

if(APPLY) g.img = TILE;
console.log("PLITKA: " + TILE);

const noimg = [], used = {};
let shown = 0, hidden = 0;

(g.cats || []).forEach(function(c){
  console.log("\n=== " + c.cat + " ===");
  const hide = HIDE[c.cat] || [];
  const map  = IMG[c.cat] || {};

  (c.offers || []).forEach(function(o){
    if(hide.indexOf(o.oid) > -1){
      if(APPLY) o.off = true;
      hidden++;
      console.log("  YOPILADI: " + o.name);
      return;
    }
    if(o.off) return;                       /* avvaldan yopiq */
    const im = map[o.oid] || "";
    if(APPLY && im) o.im = im;
    if(im) used[im] = 1; else noimg.push(c.cat + " / " + o.name);
    shown++;
    console.log("  " + o.name.padEnd(20) + " <- " + (im || "RASM YO'Q"));
  });
});

if(noimg.length){
  console.log("\n--- RASMSIZ QOLGAN ---");
  noimg.forEach(function(x){ console.log("  " + x); });
}
const all = [];
for(let i=1;i<=40;i++) all.push("/call-of-x"+i+".png");
const unused = all.filter(function(f){ return !used[f]; });
if(unused.length) console.log("\nISHLATILMAGAN: " + unused.join(", "));

console.log("\nKo'rinadi: " + shown + " | yangi yopilgan: " + hidden);

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("YOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("Hech narsa o'zgartirilmadi. Rozi bo'lsangiz: node codmimg.js --yes");
}
