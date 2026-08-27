/* games.json: narxlarni qoida bo'yicha qayta hisoblaydi VA 2 mln dan
   qimmat paketlarni yashiradi (off:true).

   Tannarx (cost) tegilmaydi — faqat price va off.
   off:true paketni ilovadan yashiradi, lekin narx ma'lumoti serverda qoladi,
   shuning uchun eski buyurtmalar buzilmaydi. Mavjud off:true lar
   hech qachon ochilmaydi — ular ataylab yopilgan bo'lishi mumkin.

   Ishlatish:
     node reprice.js          -> faqat ko'rsatadi
     node reprice.js --yes    -> zaxira nusxa olib, yozadi
*/
const fs = require("fs");
const FILE  = "/root/donate-app/games.json";
const APPLY = process.argv.indexOf("--yes") > -1;
const CEIL  = 2000000;

function retail(cost){
  let r;
  if      (cost <=   6000) r = cost +  2500;
  else if (cost <=  15000) r = cost +  5000;
  else if (cost <=  40000) r = cost + 10000;
  else if (cost <= 100000) r = cost + 15000;
  else                     r = cost * 1.12;
  return Math.ceil(r / 500) * 500;
}
function n(x){ return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
let total=0, same=0, up=0, down=0, skip=0, loss=0, hid=0, already=0;
const moves = [], hides = [], empty = [];

(raw.games || []).forEach(function(g){
  (g.cats || []).forEach(function(c){
    let shown = 0;
    (c.offers || []).forEach(function(o){
      total++;
      const cost = Number(o.cost) || 0;
      if(!cost){ skip++; if(!o.off) shown++; return; }

      const old = Number(o.price) || 0;
      if(old && old <= cost) loss++;
      const neu = retail(cost);

      if(neu === old) same++;
      else {
        (neu > old) ? up++ : down++;
        moves.push({ cat:c.cat, name:o.name, cost:cost, old:old, neu:neu, d:neu-old });
      }
      if(APPLY) o.price = neu;

      /* chegaradan oshgan bo'lsa yashiramiz */
      if(neu > CEIL){
        if(o.off) already++;
        else { hid++; hides.push({ cat:c.cat, name:o.name, price:neu }); if(APPLY) o.off = true; }
      } else if(!o.off) shown++;
    });
    if(!shown) empty.push(c.cat);
  });
});

console.log("Jami paket: " + total + " | tannarxsiz: " + skip);
console.log("Narx: o'zgarmaydi " + same + " | qimmatlashadi " + up + " | arzonlashadi " + down);
if(loss) console.log("!!! ZARARLI (narx <= tannarx): " + loss + " ta");
console.log("Yashiriladi (" + n(CEIL) + " dan qimmat): " + hid + " ta | avvaldan yopiq: " + already);

console.log("\n--- yashiriladiganlar ---");
hides.sort(function(a,b){ return b.price - a.price; });
hides.forEach(function(h){ console.log(h.cat + " | " + h.name + " | " + n(h.price)); });

console.log("\n--- eng katta 15 narx o'zgarishi (yashirilmaganlar ichida) ---");
moves.filter(function(m){ return m.neu <= CEIL; })
     .sort(function(a,b){ return Math.abs(b.d) - Math.abs(a.d); })
     .slice(0,15)
     .forEach(function(m){
       console.log(m.cat + " | " + m.name + " | tan " + n(m.cost) +
                   " | " + n(m.old) + " -> " + n(m.neu) +
                   " (" + (m.d>0?"+":"") + n(m.d) + ")");
     });

if(empty.length) console.log("\n!!! DIQQAT: bo'shab qolgan kategoriya: " + empty.join(", "));

if(APPLY){
  const bak = FILE + ".bak-" + Date.now();
  fs.copyFileSync(FILE, bak);
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 1));
  console.log("\nYOZILDI. Zaxira: " + bak);
  console.log("Endi: pm2 restart all --update-env");
} else {
  console.log("\nHech narsa o'zgartirilmadi. Rozi bo'lsangiz: node reprice.js --yes");
}
