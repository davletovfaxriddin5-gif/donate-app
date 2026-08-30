/* Oltita o'yinga plitka rasmi + "TEXNIK ISH" rejimi
   node maint.js         -> faqat ko'rsatadi
   node maint.js --yes   -> zaxira olib yozadi
   node maint.js --off   -> texnik ishni O'CHIRADI (hammaga ochadi)
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;
const OFF   = process.argv.indexOf("--off") > -1;

const SET = {
  genshinimpact:    "/genshin-x1.jpg",
  valorant:         "/valorant-x1.jpg",
  zenlesszonezero:  "/zenlees-x1.jpg",
  pointblank:       "/blank-x1.jpg",
  swordofjustice:   "/sword-x1.jpg",
  wherewindsmeet:   "/meet-x1.jpg"
};

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const miss = [];

Object.keys(SET).forEach(function(id){
  const g = (raw.games || []).find(function(x){ return x.id === id; });
  if(!g){ miss.push(id); return; }
  if(APPLY || OFF){
    g.img = SET[id];
    if(OFF) delete g.maint; else g.maint = true;
  }
  console.log((OFF ? "OCHILADI:  " : "TEXNIK ISH: ") + g.name.padEnd(24) + " <- " + SET[id]);
});

if(miss.length){
  console.log("\n!!! TOPILMAGAN O'YIN: " + miss.join(", "));
}

if((APPLY || OFF) && !miss.length){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else if(APPLY || OFF){
  console.log("\nYOZILMADI — topilmagan o'yin bor.");
} else {
  console.log("\nHech narsa o'zgartirilmadi.");
  console.log("Yoqish: node maint.js --yes   |   keyinroq ochish: node maint.js --off");
}
