/* FazerCards'dan BARCHA kategoriyalarning asl narxini (USD) yig'adi.
   Ishga tushirish:  cd /root/donate-app && node costs.js
   Natija:           /root/donate-app/fzr-costs.json
   Bu fayl foyda hisobi uchun kerak — server undan tannarxni oladi. */
const fs = require("fs");
const KEY  = (fs.readFileSync("/root/donate-app/.env","utf8").match(/^FZR_API_KEY=(.*)$/m)||[])[1]||"";
const BASE = "https://api.fzr.cards";
const CATS = ["arena_breakout","arena_breakout_infinite","blood_strike","blood_strike_mena","codm_activision_ca","codm_activision_in","codm_activision_kz","codm_activision_sa","codm_activision_us","codm_garena_sgmy","delta_force","eafc_mobile_id","eafc_mobile_kh","eafc_mobile_my","eafc_mobile_sg","free_fire_cis","garena_delta_force_indonesia","garena_delta_force_my","genshin_impact_global","honor_of_kings","legend_of_neverland","legend_of_neverland_naeu","magic_chess_gogo_global","magic_chess_gogo_ru","mobile_legends_brazil","mobile_legends_global","mobile_legends_indonesia","mobile_legends_malaysia","mobile_legends_philippines","mobile_legends_ru","mobile_legends_singapore","mobile_legends_turkey","mobile_legends_united_states","modern_strike_online","point_blank_id","pubg_mobile_auto","r6_mobile_global","r6_mobile_id","r6_mobile_my","r6_mobile_ph","r6_mobile_sg","r6_mobile_th","r6_mobile_us","sword_of_justice_eu","sword_of_justice_na","sword_of_justice_sea","telegram_premium","undawn_garena_global","undawn_garena_id","undawn_garena_sg","valorant_id","valorant_kh","valorant_my","valorant_ph","valorant_sg","valorant_th","valorant_vn","where_winds_meet","zenless_zone_zero_global","zenless_zone_zero_ru","zenless_zone_zero_us"];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u){
  const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),25000);
  try{ const r=await fetch(u,{headers:{"X-API-Key":KEY},signal:ac.signal}); return await r.json(); }
  catch(e){ return {ok:false,error:e.message}; } finally{ clearTimeout(tm); }
}
(async function(){
  if(!KEY){ console.log("XATO: .env dan FZR_API_KEY topilmadi"); return; }
  const out={}; let n=0, fail=[];
  for(const c of CATS){
    const j = await get(BASE+"/api/v2/topups/offers?category_id="+encodeURIComponent(c));
    if(!j || !j.ok || !Array.isArray(j.offers)){ fail.push(c); await sleep(200); continue; }
    out[c] = {};
    j.offers.forEach(function(o){
      const u = Number(o.price_usd)||0;
      if(u > 0){ out[c][o.offer_id] = u; n++; }
    });
    await sleep(200);
  }
  /* Telegram Stars alohida endpoint'da */
  try{
    const a = await get(BASE+"/api/v2/telegram/stars");
    if(a && a.ok) out["_tg_stars"] = a;
  }catch(e){}

  fs.writeFileSync("/root/donate-app/fzr-costs.json", JSON.stringify(out));
  console.log("=== TAYYOR ===");
  console.log("kategoriya: " + Object.keys(out).length + "   paket: " + n);
  console.log("fayl: fzr-costs.json");
  if(fail.length) console.log("OLINMADI (" + fail.length + "): " + fail.join(", "));
})();
