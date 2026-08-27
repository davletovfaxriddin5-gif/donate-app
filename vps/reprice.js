/* games.json narxlarini tasdiqlangan qoida bo'yicha qayta hisoblaydi.
   Tannarx (cost) va boshqa hamma narsa tegilmaydi — faqat price.

   Ishlatish:
     node reprice.js          -> faqat ko'rsatadi, faylni o'zgartirmaydi
     node reprice.js --yes    -> zaxira nusxa olib, faylni yozadi
*/
const fs = require("fs");
const FILE = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;

/* Tasdiqlangan pog'onalar (tannarx so'mda) */
function retail(cost){
  let r;
  if      (cost <=   6000) r = cost +  2500;
  else if (cost <=  15000) r = cost +  5000;
  else if (cost <=  40000) r = cost + 10000;
  else if (cost <= 100000) r = cost + 15000;
  else                     r = cost * 1.12;
  return Math.ceil(r / 500) * 500;
}

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
let total = 0, same = 0, up = 0, down = 0, skip = 0, loss = 0;
const moves = [];

(raw.games || []).forEach(function(g){
  (g.cats || []).forEach(function(c){
    (c.offers || []).forEach(function(o){
      total++;
      const cost = Number(o.cost) || 0;
      if(!cost){ skip++; return; }
      const old = Number(o.price) || 0;
      if(old && old <= cost) loss++;
      const neu = retail(cost);
      if(neu === old){ same++; return; }
      if(neu > old) up++; else down++;
      moves.push({ g:g.id, cat:c.cat, name:o.name, cost:cost, old:old, neu:neu, d:neu-old });
      if(APPLY) o.price = neu;
    });
  });
});

function n(x){ return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

console.log("Jami paket: " + total + " | tannarxsiz: " + skip);
console.log("O'zgarmaydi: " + same + " | qimmatlashadi: " + up + " | arzonlashadi: " + down);
if(loss) console.log("!!! HOZIR ZARARLI (narx <= tannarx): " + loss + " ta");

moves.sort(function(a,b){ return Math.abs(b.d) - Math.abs(a.d); });
console.log("\n--- eng katta 20 o'zgarish ---");
moves.slice(0,20).forEach(function(m){
  console.log(m.cat + " | " + m.name + " | tannarx " + n(m.cost) +
              " | " + n(m.old) + " -> " + n(m.neu) +
              " (" + (m.d>0?"+":"") + n(m.d) + ")");
});

/* O'yin bo'yicha jamlama */
const perGame = {};
moves.forEach(function(m){ perGame[m.g] = (perGame[m.g]||0) + 1; });
console.log("\n--- o'yin bo'yicha nechta narx o'zgaradi ---");
Object.keys(perGame).sort().forEach(function(k){ console.log(k + ": " + perGame[k]); });

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira nusxa: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node reprice.js --yes");
}
