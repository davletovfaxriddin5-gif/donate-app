/* O'yin sahifasining tepasiga KENG 16:9 banner (rasm yoki video)
   node vid.js                       -> hozirgi holat
   node vid.js <id> <fayl> --yes     -> banner qo'yadi
   node vid.js <id> off --yes        -> bannerni olib tashlaydi

   .mp4 / .webm  -> video banner
   .webp/.jpg/.png -> rasm banner

   Misol:
     node vid.js legendofneverland /never-x1.webp --yes
     node vid.js legendofneverland off --yes
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const a = process.argv.slice(2).filter(function(x){ return x !== "--yes"; });
const APPLY = process.argv.indexOf("--yes") > -1;

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));

if(!a.length){
  console.log("HOZIRGI HOLAT:\n");
  (raw.games || []).forEach(function(g){
    console.log("  " + g.id.padEnd(20) + (g.vid || g.bg || "\u2014"));
  });
  console.log("\nQo'yish:  node vid.js <id> /v-nomi.mp4 --yes");
  console.log("Olib tashlash: node vid.js <id> off --yes");
  process.exit(0);
}

const id = a[0], src = a[1] || "";
const g = (raw.games || []).find(function(x){ return x.id === id; });
if(!g){ console.log("Topilmadi: " + id); process.exit(1); }
if(!src){ console.log("Fayl nomi kerak"); process.exit(1); }

const isVid = /\.(mp4|webm|mov)$/i.test(src);
if(src === "off") console.log(g.name + ": banner OLIB TASHLANADI");
else console.log(g.name + ": " + (isVid ? "VIDEO" : "RASM") + " banner <- " + src);

if(APPLY){
  delete g.vid; delete g.bg;
  if(src !== "off"){ if(isVid) g.vid = src; else g.bg = src; }
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("YOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("(ko'rish rejimi \u2014 qo'llash uchun oxiriga --yes qo'shing)");
}
