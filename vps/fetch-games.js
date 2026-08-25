/* FazerCards dan 17 ta o'yinning barcha paketlarini yig'adi.
   Ishga tushirish:  cd /root/donate-app && node fetch-games.js
   Natija:           /root/donate-app/fzr-offers.json  (to'liq ma'lumot)
   Ekranga faqat qisqa hisobot chiqadi. */

const fs = require("fs");
const KEY  = (fs.readFileSync("/root/donate-app/.env", "utf8")
  .match(/^FZR_API_KEY=(.*)$/m) || [])[1] || "";
const BASE = "https://api.fzr.cards";

const CATS = [
  ["Arena Breakout",        ["arena_breakout", "arena_breakout_infinite"]],
  ["Blood Strike",          ["blood_strike", "blood_strike_mena"]],
  ["Call of Duty Mobile",   ["codm_activision_ca","codm_activision_in","codm_activision_kz",
                             "codm_activision_sa","codm_activision_us","codm_garena_sgmy"]],
  ["Delta Force",           ["delta_force","garena_delta_force_indonesia","garena_delta_force_my"]],
  ["EAFC Mobile",           ["eafc_mobile_id","eafc_mobile_kh","eafc_mobile_my","eafc_mobile_sg"]],
  ["Undawn",                ["undawn_garena_global","undawn_garena_id","undawn_garena_sg"]],
  ["Genshin Impact",        ["genshin_impact_global"]],
  ["Honor of Kings",        ["honor_of_kings"]],
  ["Legend of Neverland",   ["legend_of_neverland","legend_of_neverland_naeu"]],
  ["Magic Chess Go Go",     ["magic_chess_gogo_global","magic_chess_gogo_ru"]],
  ["Modern Strike Online",  ["modern_strike_online"]],
  ["Point Blank",           ["point_blank_id"]],
  ["Rainbow Six Mobile",    ["r6_mobile_global","r6_mobile_id","r6_mobile_my","r6_mobile_ph",
                             "r6_mobile_sg","r6_mobile_th","r6_mobile_us"]],
  ["Sword of Justice",      ["sword_of_justice_eu","sword_of_justice_na","sword_of_justice_sea"]],
  ["Valorant",              ["valorant_id","valorant_kh","valorant_my","valorant_ph",
                             "valorant_sg","valorant_th","valorant_vn"]],
  ["Where Winds Meet",      ["where_winds_meet"]],
  ["Zenless Zone Zero",     ["zenless_zone_zero_global","zenless_zone_zero_ru","zenless_zone_zero_us"]],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url){
  const ac = new AbortController();
  const tm = setTimeout(()=>ac.abort(), 25000);
  try{
    const r = await fetch(url, { headers:{ "X-API-Key": KEY }, signal: ac.signal });
    return await r.json();
  }catch(e){ return { ok:false, error:e.message }; }
  finally{ clearTimeout(tm); }
}

(async function(){
  if(!KEY){ console.log("XATO: .env dan FZR_API_KEY topilmadi"); return; }

  /* kategoriya izohlari (qanday ID kerakligi shu yerda yozilgan) */
  const all = await get(BASE + "/api/v2/topups?limit=1000");
  const notes = {};
  (all.items || []).forEach(function(c){ notes[c.category_id] = c.note || ""; });

  const out = {};
  let total = 0, failed = [];

  for(const [game, ids] of CATS){
    out[game] = {};
    for(const id of ids){
      const j = await get(BASE + "/api/v2/topups/offers?category_id=" + encodeURIComponent(id));
      if(!j || !j.ok || !Array.isArray(j.offers)){ failed.push(id); await sleep(250); continue; }
      out[game][id] = { name: j.name || id, note: notes[id] || "", offers: j.offers };
      total += j.offers.length;
      await sleep(250);          /* API ni bosmaslik uchun */
    }
  }

  fs.writeFileSync("/root/donate-app/fzr-offers.json", JSON.stringify(out, null, 1));

  /* ---- qisqa hisobot ---- */
  console.log("=== YIG'ILDI ===");
  console.log("jami paket: " + total + "   fayl: fzr-offers.json");
  if(failed.length) console.log("OLINMADI: " + failed.join(", "));
  console.log("");
  console.log("o'yin                     kat  paket   eng arzon   eng qimmat");
  for(const [game, ids] of CATS){
    const cs = Object.keys(out[game] || {});
    let n = 0, mn = 1e9, mx = 0;
    cs.forEach(function(c){
      out[game][c].offers.forEach(function(o){
        const p = Number(o.price_usd) || 0;
        n++; if(p && p < mn) mn = p; if(p > mx) mx = p;
      });
    });
    console.log(game.padEnd(24) + String(cs.length).padStart(4) +
                String(n).padStart(7) + ("$" + (mn===1e9?0:mn).toFixed(2)).padStart(12) +
                ("$" + mx.toFixed(2)).padStart(13));
  }

  /* ---- har bir o'yin qanday ID so'rashi ---- */
  console.log("\n=== QANDAY ID KERAK ===");
  for(const [game, ids] of CATS){
    const first = Object.keys(out[game] || {})[0];
    if(!first) continue;
    const note = (out[game][first].note || "").replace(/\n/g, " ").slice(0, 90);
    console.log(game.padEnd(24) + " | " + note);
  }
})();
