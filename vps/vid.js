/* O'yin sahifasining tepasiga video banner
   node vid.js                    -> hozirgi holat
   node vid.js <id> <fayl> --yes  -> video qo'yadi
   node vid.js <id> off --yes     -> videoni olib tashlaydi

   Misol:
     node vid.js legendofneverland /v-neverland.mp4 --yes
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
    console.log("  " + g.id.padEnd(20) + (g.vid ? g.vid : "\u2014"));
  });
  console.log("\nQo'yish:  node vid.js <id> /v-nomi.mp4 --yes");
  console.log("Olib tashlash: node vid.js <id> off --yes");
  process.exit(0);
}

const id = a[0], src = a[1] || "";
const g = (raw.games || []).find(function(x){ return x.id === id; });
if(!g){ console.log("Topilmadi: " + id); process.exit(1); }
if(!src){ console.log("Fayl nomi kerak"); process.exit(1); }

if(src === "off") console.log(g.name + ": video OLIB TASHLANADI");
else              console.log(g.name + ": video <- " + src);

if(APPLY){
  if(src === "off") delete g.vid; else g.vid = src;
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("YOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("(ko'rish rejimi \u2014 qo'llash uchun oxiriga --yes qo'shing)");
}
