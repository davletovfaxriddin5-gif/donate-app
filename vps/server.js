/* ---------- .env dan o'qish (VPS qayta yuklansa ham kalitlar yo'qolmasin) ---------- */
try{
  const _t = require("fs").readFileSync("/root/donate-app/.env","utf8");
  _t.split("\n").forEach(function(line){
    const s = line.trim();
    if(!s || s[0] === "#") return;
    const i = s.indexOf("=");
    if(i < 1) return;
    const k = s.slice(0,i).trim();
    let v = s.slice(i+1).trim();
    if(v.length > 1 && ((v[0] === '"' && v.slice(-1) === '"') || (v[0] === "'" && v.slice(-1) === "'"))) v = v.slice(1,-1);
    if(!process.env[k]) process.env[k] = v;
  });
}catch(e){}

try{ require("dns").setDefaultResultOrder("ipv4first"); }catch(e){}
const express = require("express");
const fs = require("fs");
const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN || "";
const SECRET = process.env.WEBHOOK_SECRET || "";
const DB = "/root/donate-app/data.json";

/* dbOk: oxirgi load() haqiqatan muvaffaqiyatli bo'ldimi.
   Xato bo'lsa load() bo'sh {} qaytaradi \u2014 va o'sha bo'shlikni saqlash
   BUTUN BAZANI o'chirib yuboradi. Shuning uchun save() uni rad etadi. */
let dbOk = true;
function load(){
  try{
    const d = JSON.parse(fs.readFileSync(DB, "utf8"));
    dbOk = true;
    return d;
  }catch(e){
    if(e.code === "ENOENT"){ dbOk = true; return {}; }   /* fayl hali yo'q \u2014 normal */
    dbOk = false;
    console.log("\u26A0\uFE0F DB O'QISH XATOSI:", e.message);
    return {};
  }
}
function save(d){
  if(!dbOk){
    console.log("\u26A0\uFE0F Oxirgi o'qish xato edi \u2014 SAQLASH BEKOR QILINDI (baza saqlanib qoldi)");
    return;
  }
  try{
    const out = JSON.stringify(d);
    let old = 0;
    try{ old = fs.statSync(DB).size; }catch(e){}
    /* Tripwire: baza keskin kichrayayotgan bo'lsa yozmaymiz.
       Bu ilovada ma'lumot faqat ko'payadi, hech qachon 4 barobar kamaymaydi. */
    if(old > 1000 && out.length < old / 4){
      console.log("\u26A0\uFE0F DB keskin kichrayapti ("+old+" -> "+out.length+" bayt) \u2014 SAQLASH BEKOR QILINDI");
      return;
    }
    fs.writeFileSync(DB + ".tmp", out);
    fs.renameSync(DB + ".tmp", DB);      /* atomik almashtirish */
  }catch(e){ console.log("DB saqlash xatosi:", e.message); }
}

/* ---------- ZAXIRA TIZIMI ----------
   1) Har 30 daqiqada butun data.json nusxasi /root/donate-backups/ ga
   2) Har 6 soatda nusxa TELEGRAM'ga hujjat sifatida yuboriladi \u2014 server
      butunlay yo'qolsa ham zaxira Telegram'da qoladi
   3) /zaxira \u2014 ro'yxat, /zaxira yangi \u2014 hozir olish, /tiklash <nom> \u2014 qaytarish */
const BKDIR = "/root/donate-backups";

function bkName(){
  const d = new Date(), z = n => String(n).padStart(2,"0");
  return "data-" + d.getFullYear() + z(d.getMonth()+1) + z(d.getDate()) +
         "-" + z(d.getHours()) + z(d.getMinutes()) + ".json";
}
function bkList(){
  try{ return fs.readdirSync(BKDIR).filter(f => /^data-.*\.json$/.test(f)).sort().reverse(); }
  catch(e){ return []; }
}
function dbBackup(){
  try{
    if(!fs.existsSync(BKDIR)) fs.mkdirSync(BKDIR, { recursive:true });
    const st = fs.statSync(DB);
    if(st.size < 50) return "";                 /* bo'sh bazani zaxiralamaymiz */
    const name = bkName();
    fs.copyFileSync(DB, BKDIR + "/" + name);
    /* Tozalash: oxirgi 48 tasi (24 soat) + har kunning birinchisi 60 kungacha */
    const all = bkList(), keep = new Set(all.slice(0,48)), seen = new Set();
    all.forEach(function(f){
      const day = f.slice(5,13);
      if(!seen.has(day)){ seen.add(day); keep.add(f); }
    });
    all.forEach(function(f){ if(!keep.has(f)){ try{ fs.unlinkSync(BKDIR+"/"+f); }catch(e){} } });
    return name;
  }catch(e){ console.log("Zaxira xatosi:", e.message); return ""; }
}

/* To'liq arxiv: data.json + games.json + fzr-offers.json + .env
   Server butunlay yo'qolsa, GitHub'dagi kod + shu arxiv = hamma narsa qaytadi. */
const BKFILES = ["data.json", "games.json", "fzr-offers.json", ".env"];

function bkArchive(){
  try{
    if(!fs.existsSync(BKDIR)) fs.mkdirSync(BKDIR, { recursive:true });
    const have = BKFILES.filter(function(f){
      try{ return fs.statSync("/root/donate-app/"+f).size > 10; }catch(e){ return false; }
    });
    if(!have.length) return "";
    const name = "toliq-" + bkName().replace(/^data-|\.json$/g, "") + ".tar.gz";
    require("child_process").execSync(
      "tar -czf " + BKDIR + "/" + name + " -C /root/donate-app " + have.join(" "),
      { timeout: 60000 });
    /* oxirgi 10 ta to'liq arxiv qoladi \u2014 ular data.json dan kattaroq */
    const old = fs.readdirSync(BKDIR).filter(f => /^toliq-.*\.tar\.gz$/.test(f)).sort().reverse();
    old.slice(10).forEach(function(f){ try{ fs.unlinkSync(BKDIR+"/"+f); }catch(e){} });
    return name;
  }catch(e){ console.log("To'liq arxiv xatosi:", e.message); return ""; }
}

/* Telegram'ga hujjat sifatida yuborish \u2014 serverdan tashqaridagi nusxa */
async function bkToTelegram(note){
  if(!TOKEN || !ADMIN_ID) return;
  try{
    const name = bkArchive();
    if(!name){ console.log("Zaxira: arxiv yaratilmadi"); return; }
    const buf = fs.readFileSync(BKDIR + "/" + name);
    let users = 0;
    try{ users = Object.keys(load()).filter(x => /^\d+$/.test(x)).length; }catch(e){}
    const fd = new FormData();
    fd.append("chat_id", ADMIN_ID);
    fd.append("caption", (note || "\uD83D\uDCBE To'liq zaxira") +
              "\nFoydalanuvchilar: " + users +
              "\nHajmi: " + buf.length + " bayt" +
              "\nIchida: " + BKFILES.join(", "));
    fd.append("document", new Blob([buf], { type:"application/gzip" }), name);
    const r = await fetch("https://api.telegram.org/bot"+TOKEN+"/sendDocument",
                          { method:"POST", body: fd });
    if(!r.ok) console.log("Zaxira TG'ga ketmadi:", r.status);
  }catch(e){ console.log("Zaxira TG xatosi:", e.message); }
}

setInterval(dbBackup, 30*60*1000);
setTimeout(function(){ dbBackup(); bkToTelegram("\uD83D\uDCBE Server ishga tushdi \u2014 zaxira"); }, 60000);
setInterval(function(){ bkToTelegram(); }, 6*3600*1000);

app.use((req,res,next)=>{
  res.header("Access-Control-Allow-Origin","*");
  res.header("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/", (req,res)=>res.json({status:"ok",message:"Minatoh VPS API ishlayapti"}));
app.get("/health", (req,res)=>res.json({success:true,server:"Contabo VPS"}));

app.get("/phone", (req,res)=>{
  const db = load();
  const rec = db[String(req.query.id||"")];
  res.json({ ok:true, phone: rec ? rec.phone : null, at: rec ? rec.at : null });
});

/* ---------- FazerCards: ID tekshirish ---------- */
const FZR_KEY  = process.env.FZR_API_KEY || "";
const FZR_BASE = "https://api.fzr.cards";
const FZR_CATS = { pubg:"pubg_mobile", freefire:"free_fire", mlbb:"mobile_legends" };

/* ---------- shop2topup: FAQAT ID tekshirish ----------
   FazerCards yangi o'yinlarni tekshira olmaydi. Yetkazish, narx va sweep
   avvalgidek FazerCards'da qoladi — bu yerda pul harakat qilmaydi.
   Kalit: FazerCards kategoriyasi -> shop2topup item_id (sinovdan o'tgan). */
const S2T_KEY  = process.env.S2T_KEY || "";
const S2T_BASE = "https://shop2topup.com/api/endpoints/v1";
const S2T_MAP = {
  arena_breakout:214, arena_breakout_infinite:2798,
  blood_strike:1638, blood_strike_mena:1638,
  codm_activision_ca:1002, codm_activision_in:1002, codm_activision_kz:1002,
  codm_activision_sa:1002, codm_activision_us:1002, codm_garena_sgmy:1002,
  delta_force:1016, garena_delta_force_indonesia:1016, garena_delta_force_my:1016,
  eafc_mobile_id:605, eafc_mobile_kh:605, eafc_mobile_my:605, eafc_mobile_sg:605,
  undawn_garena_global:1078, undawn_garena_id:1078, undawn_garena_sg:1078,
  honor_of_kings:198,
  legend_of_neverland:3191, legend_of_neverland_naeu:3191,
  modern_strike_online:2284,
  r6_mobile_global:703, r6_mobile_id:703, r6_mobile_my:703, r6_mobile_ph:703,
  r6_mobile_sg:703, r6_mobile_th:703, r6_mobile_us:703
};
/* Maydon nomi o'yinga qarab farq qiladi — birinchi to'lganini olamiz */
/* ---------- aluu.in nickname tekshiruvi (uchinchi manba) ----------
   Bepul: kuniga 100 ta so'rov. FazerCards va shop2topup yo'liga TEGMAYDI. */
const ALUU_KEY  = process.env.ALUU_KEY || "";
const ALUU_BASE = "https://aluu.in/api/check/game-check";
/* games.json dagi kategoriya nomi -> aluu.in kodi va kerakli maydonlar */
const ALUU_MAP = {
  where_winds_meet: { code:"wwm", srv:false }
};

function aluuPid(f){
  const k = ["character_id","player_id","user_id","uid","id","account_id"];
  for(let i=0;i<k.length;i++){ const v=String(f[k[i]]||"").trim(); if(v) return v; }
  const n = {};
  Object.keys(f||{}).forEach(function(x){
    n[String(x).replace(/[-\s]/g,"_").replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase()] = f[x];
  });
  for(let i=0;i<k.length;i++){ const v=String(n[k[i]]||"").trim(); if(v) return v; }
  return "";
}

async function aluuValidate(m, fields){
  if(!ALUU_KEY) return { ok:false, reason:"error" };
  const pid = aluuPid(fields);
  if(!pid) return { ok:false, reason:"bad_id" };
  let url = ALUU_BASE + "?code=" + encodeURIComponent(m.code) +
            "&characterId=" + encodeURIComponent(pid);
  if(m.srv){
    const z = String(fields.server_code || fields.zone_id || fields.server_id || fields.server || "").trim();
    if(z) url += "&server_code=" + encodeURIComponent(z);
  }
  const ac = new AbortController();
  const tm = setTimeout(()=>ac.abort(), 20000);
  try{
    const r = await fetch(url, { headers:{ "x-api-key": ALUU_KEY }, signal: ac.signal });
    const txt = await r.text();
    let j = null;
    try{ j = JSON.parse(txt); }catch(e){}
    if(!j){ console.log("ALUU javob JSON emas:", txt.slice(0,120)); return { ok:false, reason:"error" }; }

    /* kunlik limit yoki tezlik cheklovi — ID ni O'TKAZIB YUBORMAYMIZ */
    if(j.code === "FREE_DAILY_LIMIT_REACHED" || j.code === "RATE_LIMITED"){
      console.log("ALUU limit:", j.code);
      return { ok:false, reason:"timeout" };
    }
    const v = String(j.valid || "").toLowerCase();
    const nm = String(j.nickname || j.name || "").trim();
    if(v === "valid" && nm && nm.toLowerCase() !== "na"){
      return { ok:true, name: nm, region: String(j.region || j.server || "") };
    }
    if(v === "invalid") return { ok:false, reason:"invalid" };
    console.log("ALUU javob:", txt.slice(0,160));
    return { ok:false, reason:"timeout" };
  }catch(e){
    console.log("ALUU xato:", e.message);
    return { ok:false, reason:"timeout" };
  } finally { clearTimeout(tm); }
}

function s2tPid(f){
  const k = ["player_id","user_id","uid","id","character_id","account_id","riot_id"];
  for(let i=0;i<k.length;i++){ const v=String(f[k[i]]||"").trim(); if(v) return v; }
  /* Mini App games.json dagi nomlarni yuboradi \u2014 ular camelCase bo'lishi mumkin
     (playerId, userId). Nomlarni normallashtirib qayta qidiramiz. */
  const norm = {};
  Object.keys(f || {}).forEach(function(key){
    norm[String(key).replace(/[-\s]/g,"_").replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase()] = f[key];
  });
  for(let i=0;i<k.length;i++){ const v=String(norm[k[i]]||"").trim(); if(v) return v; }
  return "";
}
async function s2tValidate(item, fields){
  if(!S2T_KEY) return { ok:false, reason:"error" };
  const pid = s2tPid(fields);
  if(!pid) return { ok:false, reason:"bad_id" };
  const body = { sub_category_id: item, player_id: pid };
  const nz = {};
  Object.keys(fields || {}).forEach(function(key){
    nz[String(key).replace(/[-\s]/g,"_").replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase()] = fields[key];
  });
  const z = String(fields.zone_id || fields.server_id || fields.server ||
                   nz.zone_id || nz.server_id || nz.server || "").trim();
  if(z) body.zone_id = z;

  const ac = new AbortController();
  /* Blood Strike'da MAVJUD BO'LMAGAN ID uchun shop2topup ~24 soniya javob beradi
     (haqiqiy ID uchun 0.2s). 12 soniya kam edi \u2014 javob kelmasdan uzilardi. */
  const tm = setTimeout(()=>ac.abort(), 30000);
  let j = {};
  try{
    const r = await fetch(S2T_BASE+"/player/validate", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+S2T_KEY },
      body: JSON.stringify(body), signal: ac.signal
    });
    j = await r.json().catch(()=>({}));
  }catch(e){
    console.log("S2T validate xato:", e.message);
    /* Timeout \u2014 alohida sabab. Ilova buni "tekshirilmadi" deb bilishi va
       ID ni O'TKAZIB YUBORMASLIGI kerak. */
    if(/abort/i.test(e.message||"")) return { ok:false, reason:"timeout" };
    return { ok:false, reason:"error" };
  } finally { clearTimeout(tm); }

  if(j && j.success && j.data && j.data.player_name)
    return { ok:true, valid:true, name:String(j.data.player_name), region:"" };

  const er = (j && j.error) || {};
  const code = String(er.code || "");
  /* Region mos kelmasa ham nom va region qaytadi — bu ham foydali javob */
  if(code === "REGION_MISMATCH" && er.player_name)
    return { ok:true, valid:true, name:String(er.player_name), region:String(er.player_region||"") };
  if(code === "PLAYER_NOT_FOUND") return { ok:false, reason:"invalid" };
  if(code === "INVALID_PRODUCT_CONFIG") return { ok:false, reason:"unsupported" };
  console.log("S2T validate javob:", JSON.stringify(j).slice(0,200));
  return { ok:false, reason:"error" };
}

const vCache = new Map();
let vCount = 0, vWindow = 0;
function vAllow(){
  const m = Math.floor(Date.now()/60000);
  if(m !== vWindow){ vWindow = m; vCount = 0; }
  if(vCount >= 200) return false;
  vCount++; return true;
}

async function validateId(req,res){
  try{
    const src = (req.method === "GET") ? (req.query||{}) : (req.body||{});
    const game     = String(src.game || "");
    const playerId = String(src.playerId || "").trim();
    const zoneId   = String(src.zoneId || "").trim();

    /* Yangi o'yinlar kategoriyani va maydonlarni o'zi yuboradi.
       FazerCards ko'pchilik kategoriyada tekshiruvni qo'llab-quvvatlamaydi —
       o'shanda "unsupported" qaytadi va ilova format bo'yicha o'tkazadi. */
    const dynCat = String(src.cat || "").trim();
    let fields, cat, key;

    if(dynCat){
      if(!GIDX_CATS[dynCat]) return res.json({ ok:false, reason:"unsupported" });
      cat = dynCat;
      fields = {};
      const src2 = src.fields && typeof src.fields === "object" ? src.fields : {};
      Object.keys(src2).slice(0,6).forEach(function(k){
        const v = String(src2[k] == null ? "" : src2[k]).trim();
        if(v) fields[k] = v.slice(0,64);
      });
      if(!Object.keys(fields).length) return res.json({ ok:false, reason:"bad_id" });
      /* DIQQAT: buyurtmada "server_id", tekshiruvda "zone_id" \u2014 MLBB dagidek.
         Nomni almashtirmasak "Missing or invalid fields" xatosi keladi. */
      if(fields.server_id && !fields.zone_id){
        fields.zone_id = fields.server_id;
        delete fields.server_id;
      }
      key = cat + ":" + JSON.stringify(fields);
    } else {
      cat = FZR_CATS[game];
      if(!cat) return res.json({ ok:false, reason:"unsupported" });
      if(!/^\d{4,15}$/.test(playerId)) return res.json({ ok:false, reason:"bad_id" });
      if(game === "mlbb" && !/^\d{1,6}$/.test(zoneId)) return res.json({ ok:false, reason:"bad_zone" });
      fields = { player_id: playerId };
      if(game === "mlbb") fields.zone_id = zoneId;
      key = game+":"+playerId+":"+zoneId;
    }
    if(!FZR_KEY){ console.log("VALIDATE: FZR_API_KEY yo'q"); return res.json({ ok:false, reason:"error" }); }
    const hit = vCache.get(key);
    if(hit && Date.now() - hit.at < 300000) return res.json(hit.data);

    /* shop2topup tekshiradigan kategoriyalar shu yerda hal bo'ladi —
       FazerCards'ga umuman bormaydi va uning limitini yemaydi */
    /* aluu.in tekshiradigan kategoriyalar — birinchi navbatda shu yerda hal bo'ladi */
    const aluuM = ALUU_MAP[cat];
    const s2tItem = S2T_MAP[cat];
    console.log("VALIDATE cat=" + JSON.stringify(cat) +
                " fields=" + JSON.stringify(fields) +
                " -> " + (aluuM ? ("aluu " + aluuM.code)
                        : s2tItem ? ("shop2topup item " + s2tItem) : "FazerCards"));
    if(aluuM){
      const d = await aluuValidate(aluuM, fields);
      if(d.ok) vCache.set(key, { at: Date.now(), data: d });
      return res.json(d);
    }
    if(s2tItem){
      const d = await s2tValidate(s2tItem, fields);
      if(d.ok) vCache.set(key, { at: Date.now(), data: d });
      return res.json(d);
    }

    if(!vAllow()) return res.json({ ok:false, reason:"busy" });

    const ac = new AbortController();
    const tm = setTimeout(()=>ac.abort(), 12000);
    let r, j = {};
    try{
      r = await fetch(FZR_BASE+"/api/v2/topups/validate-id", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "X-API-Key": FZR_KEY },
        body: JSON.stringify({ category_id: cat, fields }),
        signal: ac.signal
      });
      j = await r.json().catch(()=>({}));
    } finally { clearTimeout(tm); }

    if(r.status === 422) return res.json({ ok:false, reason:"unconfirmed" });
    if(r.status === 401 || r.status === 403){
      console.log("VALIDATE auth xato:", r.status, JSON.stringify(j));
      return res.json({ ok:false, reason:"error" });
    }
    if(!r.ok && /not available|missing or invalid fields/i.test(String(j.error || ""))){
      console.log("VALIDATE qo'llab-quvvatlanmaydi:", cat, JSON.stringify(j.error||""));
      return res.json({ ok:false, reason:"unsupported" });
    }
    if(!r.ok || !j.ok || !j.valid){
      console.log("VALIDATE javob:", r.status, JSON.stringify(j));
      return res.json({ ok:false, reason:"invalid" });
    }

    const data = { ok:true, valid:true, name: j.player_name || "", region: j.region || "" };
    vCache.set(key, { at: Date.now(), data });
    res.json(data);
  }catch(e){
    console.log("VALIDATE XATO:", e.message);
    res.json({ ok:false, reason:"error" });
  }
}
app.get("/validate", validateId);
app.post("/validate", validateId);

/* ---------- FazerCards: avtomatik yetkazish ---------- */
/* DIQQAT: narxlar shu yerda turadi. index.html dagi narxlar bilan BIR XIL bo'lishi shart.
   Mijoz yuborgan narxga ishonmaymiz — server o'zi jadvaldan oladi. */
const CATALOG = {
  /* Standoff 2 \u2014 coindrop.uz orqali (CD_GAMES ga qarang).
     Narxlar bracket jadvali bo'yicha; tannarx coindrop price_uzs. */
  standoff2: { cat:"", srv:false, items:{
    "100G":18000, "200G":34500, "300G":54500, "500G":86000
  }},
  pubg: { cat:"pubg_mobile_auto", srv:false, items:{
    "60_uc":13000, "325_uc":62000, "660_uc":123000,
    "1800_uc":307000, "3850_uc":613000, "8100_uc":1226000
  }},
  freefire: { cat:"free_fire_cis", srv:false, items:{
    "110_diamonds":13000, "341_diamonds":34000, "572_diamonds":54000,
    "1166_diamonds":112000, "2398_diamonds":212000, "6160_diamonds":537000
  }},
  mlbb: { cat:"mobile_legends_global", srv:true, items:{
    "50_5_diamonds_first_top_up_bonus":12000, "150_15_diamonds_first_top_up_bonus":33000,
    "250_25_diamonds_first_top_up_bonus":51000, "500_65_diamonds_first_top_up_bonus":103000,
    "10_1_diamonds":5000, "51_5_diamonds":15000, "78_8_diamonds":19500, "156_16_diamonds":33500,
    "234_23_diamonds":46000, "625_81_diamonds":125000, "1860_335_diamonds":377000,
    "3099_589_diamonds":630000, "4649_883_diamonds":951000, "7740_1548_diamonds":1583000,
    "weekly_pass":22000, "twilight_pass":130000
  }},
  /* Telegram Premium: 3 ta qat'iy paket, @username ga yuboriladi */
  tgpremium: { cat:"telegram_premium", srv:false, tg:"premium", items:{
    "premium_3":169000, "premium_6":225000, "premium_12":399000
  }}
};

/* ---------- TG Stars: paket yo'q, mijoz miqdorni o'zi kiritadi ----------
   1 yulduz tannarxi ~188 so'm. Kichik buyurtmada 1 yulduz qimmatroq turadi,
   shunda 50 tada ham foyda qoladi, 5000 tada esa narx raqobatbardosh bo'ladi.
   Bosqichlar shunday tanlanganki, KO'PROQ olgan hech qachon ORTIQ to'lamaydi. */
const STARS_MIN = 50, STARS_MAX = 10000;
const STARS_TIERS = [
  { upto:  99,    rate: 250 },   /*  50-99   -> foyda ~3 100-6 200 */
  { upto:  249,   rate: 240 },   /* 100-249  -> foyda ~5 200-13 000 */
  { upto:  999,   rate: 230 },   /* 250-999  -> foyda ~10 600-42 200 */
  { upto:  10000, rate: 220 }    /* 1000+    -> foyda 32 000 dan yuqori */
];
function starsRate(n){
  for(let i = 0; i < STARS_TIERS.length; i++) if(n <= STARS_TIERS[i].upto) return STARS_TIERS[i].rate;
  return STARS_TIERS[STARS_TIERS.length-1].rate;
}
function starsPrice(n){ return n * starsRate(n); }

/* Ilova miqdorni qaysi nom bilan yuborishi aniq emas \u2014 barchasini ko'ramiz.
   Topilmasa buyurtma rad etiladi va kelgan obyekt logga yoziladi. */
function starsQty(o){
  const d = o.details || {};
  const cand = [o.qty, o.amount, o.quantity, o.stars, o.n, o.a,
                d.qty, d.amount, d.quantity, d.stars, d.summa, d.miqdor, o.package];
  for(let i = 0; i < cand.length; i++){
    const s = String(cand[i] == null ? "" : cand[i]).replace(/[^0-9]/g, "");
    if(s){ const v = parseInt(s, 10); if(v > 0) return v; }
  }
  return 0;
}

/* MLBB regionlari \u2014 har birida boshqa paketlar va boshqa narxlar */
const MLBB_REG = {
  ru: { cat:"mobile_legends_ru", items:{
    "35_diamonds":11000,
    "55_diamonds":15000,
    "super_value_pass":22000,
    "weekly_pass":28400,
    "165_diamonds":42000,
    "275_diamonds":75000,
    "565_diamonds":145000,
    "1155_diamonds":282000,
    "1765_diamonds":420000,
    "2975_diamonds":699000,
    "6000_diamonds":1392000
  }},
  indonesia: { cat:"mobile_legends_indonesia", items:{
    "17_2_diamonds":4500,
    "25_3_diamonds":8000,
    "40_4_diamonds":10000,
    "53_6_diamonds":12000,
    "weekly_elite_pack":15000,
    "77_8_diamonds":19000,
    "weekly_pass":30000,
    "154_16_diamonds":35000,
    "217_23_diamonds":55000,
    "367_41_diamonds":83000,
    "503_65_diamonds":115000,
    "twilight_pass":115000,
    "774_101_diamonds":175000,
    "1708_302_diamonds":385000,
    "4003_827_diamonds":896000
  }},
  malaysia: { cat:"mobile_legends_malaysia", items:{
    "38_4_diamonds":11000,
    "weekly_elite_pack":16300,
    "64_6_diamonds":18000,
    "weekly_pass":29400,
    "127_13_diamonds":33000,
    "254_30_diamonds":66000,
    "monthly_elite_pack":67000,
    "317_38_diamonds":83000,
    "383_46_diamonds":98000,
    "twilight_pass":123000,
    "633_83_diamonds":163000,
    "940_144_diamonds":237000,
    "1252_194_diamonds":307000,
    "2501_475_diamonds":656000,
    "6252_1250_diamonds":1635000
  }},
  philippines: { cat:"mobile_legends_philippines", items:{
    "20_2_diamonds":7600,
    "51_5_diamonds":15000,
    "102_10_diamonds":27000,
    "weekly_diamond_pass":29000,
    "153_15_diamonds":37000,
    "203_20_diamonds":48700,
    "303_33_diamonds":72000,
    "504_66_diamonds":121000,
    "twilight_pass":123000,
    "1007_156_diamonds":242000,
    "2015_383_diamonds":485000,
    "5035_1007_diamonds":1212000
  }},
  singapore: { cat:"mobile_legends_singapore", items:{
    "38_4_diamonds":13500,
    "64_6_diamonds":18200,
    "weekly_elite_pack":28000,
    "weekly_pass":29000,
    "127_13_diamonds":33000,
    "monthly_elite_pack":71000,
    "254_30_diamonds":74000,
    "317_38_diamonds":83000,
    "383_46_diamonds":99000,
    "633_83_diamonds":165000,
    "940_144_diamonds":252000,
    "1252_194_diamonds":325000,
    "2501_475_diamonds":649000,
    "6252_1250_diamonds":1590000
  }},
  turkey: { cat:"mobile_legends_turkey", items:{
    "24_diamonds":8000,
    "44_diamonds":13700,
    "weekly_elite_pack":18600,
    "88_diamonds":19300,
    "weekly_pass":28300,
    "133_diamonds":30000,
    "221_diamonds":46000,
    "monthly_elite_pack":66000,
    "494_diamonds":99800,
    "twilight_pass":113000,
    "1041_diamonds":201000,
    "2645_diamonds":502000,
    "6146_diamonds":1149000
  }},
  united_states: { cat:"mobile_legends_united_states", items:{
    "51_5_diamonds":13500,
    "weekly_diamond_pass":29700,
    "253_25_diamonds":64000,
    "505_66_diamonds":119000,
    "1010_182_diamonds":239000,
    "1515_273_diamonds":380000,
    "2525_480_diamonds":612000,
    "3030_576_diamonds":711000,
    "4008_802_diamonds":979000,
    "5010_1002_diamonds":1215000
  }},
  brazil: { cat:"mobile_legends_brazil", items:{
    "50_5_diamonds":14500,
    "78_8_diamonds":18000,
    "weekly_pass":24700,
    "156_16_diamonds":31000,
    "150_15_diamonds":33500,
    "234_23_diamonds":45000,
    "310_34_diamonds":51000,
    "250_25_diamonds":53500,
    "465_51_diamonds":70500,
    "482_diamonds":71000,
    "500_65_diamonds":107000,
    "twilight_pass":113000,
    "625_81_diamonds":129000,
    "1860_335_diamonds":397000,
    "3099_589_diamonds":584000,
    "4649_883_diamonds":961000,
    "7740_1548_diamonds":1602000
  }}
};

function mlRegion(region){
  const r = String(region||"").toLowerCase();
  if(r.indexOf("russ") > -1 || r === "ru") return "ru";
  if(r.indexOf("indonesi") > -1) return "indonesia";
  if(r.indexOf("malays") > -1) return "malaysia";
  if(r.indexOf("philippin") > -1 || r.indexOf("filipin") > -1) return "philippines";
  if(r.indexOf("singapor") > -1) return "singapore";
  if(r.indexOf("turk") > -1 || r.indexOf("t\u00fcrk") > -1) return "turkey";
  if(r.indexOf("united states") > -1 || r === "usa" || r === "us") return "united_states";
  if(r.indexOf("brazil") > -1 || r.indexOf("brasil") > -1) return "brazil";
  return "global";
}

/* O'yin + paket + akkaunt regioni -> qaysi kategoriya va qaysi narx */
function resolveOffer(game, oid, region){
  const cfg = CATALOG[game];
  if(!cfg) return null;
  let cat = cfg.cat, items = cfg.items;
  if(game === "mlbb"){
    const k = mlRegion(region);
    if(MLBB_REG[k]){ cat = MLBB_REG[k].cat; items = MLBB_REG[k].items; }
  }
  if(items[oid] == null) return null;
  return { cat: cat, price: items[oid], srv: !!cfg.srv, tg: cfg.tg || "" };
}

/* MLBB Global: bu paketlar MY/SG/PH/ID/RU akkauntlarida ishlamaydi */
const MLBB_LIMITED = ["78_8_diamonds","156_16_diamonds","234_23_diamonds","625_81_diamonds",
  "1860_335_diamonds","3099_589_diamonds","4649_883_diamonds","7740_1548_diamonds","weekly_pass"];
const MLBB_LIMITED_REG = ["russia","indonesia","malaysia","singapore","philippines"];
const MLBB_BLOCKED_REG = ["indonesia","brazil"];

/* Ilova o'yin KALITINI o.gameId da yuboradi ("mlbb"), o.game esa ko'rsatish uchun ("mobile legends").
   O'yinchi ID va server esa o.details ichida (playerId / serverId). */
const GAME_ALIAS = {
  pubg:"pubg", pubgmobile:"pubg", pubgm:"pubg",
  freefire:"freefire", ff:"freefire", garenafreefire:"freefire",
  mlbb:"mlbb", mobilelegends:"mlbb", mobilelegend:"mlbb", ml:"mlbb",
  tgstars:"tgstars", tgstar:"tgstars", stars:"tgstars", telegramstars:"tgstars",
  tgpremium:"tgpremium", premium:"tgpremium", telegrampremium:"tgpremium",
  /* gameKey() raqamlarni olib tashlaydi: "standoff2" -> "standoff" */
  standoff:"standoff2", standoffii:"standoff2", so:"standoff2"
};
function gameKey(o){
  const cand = [o.gameId, o.game, o.key, o.g];
  for(let i = 0; i < cand.length; i++){
    const s = String(cand[i]||"").toLowerCase().replace(/[^a-z]/g,"");
    if(GAME_ALIAS[s]) return GAME_ALIAS[s];
  }
  return "";
}

function fzrFields(game, o){
  const d = o.details || {};
  const pid = String(d.playerId || d.player_id || d.uid || d.id || o.playerId || "").trim();
  const srv = String(d.serverId || d.server_id || d.zoneId || d.zone_id ||
                     d.server || d.zone || o.serverId || o.zoneId || "").trim();
  const f = {};
  if(pid) f.player_id = pid;
  if(game === "mlbb" && srv) f.server_id = srv;
  return f;
}

/* ---------- Yangi o'yinlar katalogi (games.json) ----------
   build-games.js yasagan fayl. Server undan narxni oladi (mijoznikiga ishonmaydi)
   va ilovaga GET /games orqali beradi \u2014 shuning uchun 779 ta paketni
   ikkala faylga qo'lda yozish kerak emas. */
const GAMES_FILE = "/root/donate-app/games.json";
const GLYPH = {
  arenabreakout:"\uD83D\uDD2B", bloodstrike:"\uD83E\uDE78", callofdutymobile:"\uD83C\uDF96\uFE0F",
  deltaforce:"\uD83E\uDE96", eafcmobile:"\u26BD", undawn:"\uD83E\uDDDF",
  genshinimpact:"\uD83C\uDF38", honorofkings:"\uD83D\uDC51", legendofneverland:"\uD83E\uDDDA",
  magicchessgogo:"\u265F\uFE0F", modernstrikeonline:"\uD83D\uDD25", pointblank:"\uD83C\uDFAF",
  rainbowsixmobile:"\uD83C\uDF08", swordofjustice:"\u2694\uFE0F", valorant:"\uD83D\uDD3A",
  wherewindsmeet:"\uD83C\uDF43", zenlesszonezero:"\u26A1"
};
let GIDX = {}, APPGAMES = [], GIDX_CATS = {};

function loadGames(){
  let raw;
  try{ raw = JSON.parse(fs.readFileSync(GAMES_FILE, "utf8")); }
  catch(e){ console.log("games.json o'qilmadi:", e.message); GIDX = {}; APPGAMES = []; return; }

  GIDX = {}; APPGAMES = []; GIDX_CATS = {};
  (raw.games || []).forEach(function(g){
    const cats = [];
    (g.cats || []).forEach(function(c){
      const shown = [];
      (c.offers || []).forEach(function(o){
        /* narx va tannarx faqat serverda qoladi */
        GIDX[c.cat + "|" + o.oid] = { price:o.price, cost:o.cost, fields:c.fields || [], gid:g.id };
        if(!o.off) shown.push({ oid:o.oid, name:o.name, price:o.price, im:o.im || "", grp:o.grp || "" });
      });
      if(shown.length){
        GIDX_CATS[c.cat] = 1;
        cats.push({ cat:c.cat, label:c.label, fields:c.fields || [], offers:shown });
      }
    });
    if(cats.length) APPGAMES.push({
      id:g.id, name:g.name, glyph: GLYPH[g.id] || "\uD83C\uDFAE", img: g.img || "",
      vid: g.vid || "", bg: g.bg || "", peek: g.peek || "", hicon: g.hicon || "", hbg: g.hbg || "", maint: !!g.maint, cats: cats
    });
  });
  console.log("games.json: " + APPGAMES.length + " o'yin, " + Object.keys(GIDX).length + " paket");
}
loadGames();

app.get("/games", (req,res)=>{
  res.json({ ok:true, games: APPGAMES });
});

/* Maydonlarni kategoriya talabiga qarab yig'amiz \u2014 nomlar o'yinga qarab
   farq qiladi: riot_id, user_id, player_id, character_id, server, zone_id... */
function catFields(defs, o){
  const d = o.details || {};
  const f = {};
  let missing = "";
  (defs || []).forEach(function(x){
    const v = String(d[x.key] == null ? "" : d[x.key]).trim();
    if(!v){ if(!missing) missing = x.key; return; }
    if(x.type === "select" && (x.options || []).length){
      const ok = x.options.some(function(op){ return String(op.value) === v; });
      if(!ok){ if(!missing) missing = x.key; return; }
    }
    f[x.key] = v;
  });
  return { fields:f, missing:missing };
}

/* ---------- coindrop.uz (uchinchi yetkazib beruvchi) ----------
   Faqat CD_GAMES dagi o'yinlar shu yerga ketadi. FazerCards yo'liga TEGILMAYDI. */
const CD_KEY  = process.env.CD_KEY || "";
const CD_BASE = "https://coindrop.uz/api/v1";
/* ilovadagi o'yin kaliti (gkey) -> coindrop game_key */
const CD_GAMES = { standoff2: "standoff2-buydon" };

async function cdCall(path, opt){
  const o = Object.assign({ headers:{} }, opt || {});
  o.headers["X-API-Key"] = CD_KEY;
  if(o.body) o.headers["Content-Type"] = "application/json";
  const r = await fetch(CD_BASE + path, o);
  let j = null;
  try{ j = await r.json(); }catch(e){}
  return { code: r.status, j: j };
}

/* Buyurtma yuborish \u2014 javob shakli fzrCreate bilan bir xil: {ok, id, why} */
async function cdCreate(gameKey, productId, playerId, myId){
  if(!CD_KEY) return { ok:false, why:"CD_KEY yo'q" };
  try{
    const r = await cdCall("/orders", { method:"POST", body: JSON.stringify({
      game_key: gameKey, product_id: String(productId), player_id: String(playerId),
      external_id: "mt-" + myId
    })});
    const j = r.j || {};
    if(r.code === 200 && j.success !== false){
      const ord = j.order || j;
      return { ok:true, id: String(ord.id || ord.order_id || "") };
    }
    return { ok:false, why: (j.error || j.message || ("HTTP " + r.code)) };
  }catch(e){ return { ok:false, why: e.message }; }
}

/* Holat: {done} | {failed, why} | {} (hali ketyapti) */
async function cdStatus(id){
  try{
    const r = await cdCall("/orders/" + encodeURIComponent(id));
    const j = r.j || {};
    const o = j.order || j;
    const s = String(o.status || "").toLowerCase();
    if(/success|done|complete|delivered/.test(s)) return { done:true };
    if(/fail|error|cancel|refund|reject/.test(s))
      return { failed:true, why: String(o.error || o.message || s) };
    return {};
  }catch(e){ return {}; }
}

async function fzrCreate(cat, oid, fields, idem){
  const ac = new AbortController();
  const tm = setTimeout(()=>ac.abort(), 25000);
  try{
    const h = { "Content-Type":"application/json", "X-API-Key": FZR_KEY };
    /* Bir xil kalit bilan qayta yuborilsa yangi buyurtma yaratilmaydi va
       QAYTA PUL YECHILMAYDI \u2014 asl buyurtma qaytariladi. */
    if(idem) h["Idempotency-Key"] = String(idem).slice(0, 255);
    const r = await fetch(FZR_BASE+"/api/v2/topups/order", {
      method:"POST", headers: h,
      body: JSON.stringify({ category_id: cat, offer_id: oid, fields: fields }),
      signal: ac.signal
    });
    const j = await r.json().catch(()=>({}));
    if(r.ok && j.ok && j.order && j.order.id) return { ok:true, id:String(j.order.id) };
    console.log("FZR order rad:", r.status, JSON.stringify(j));
    return { ok:false, why: String(j.error || ("HTTP "+r.status)) };
  }catch(e){
    console.log("FZR order xato:", e.message);
    return { ok:false, why:"network" };
  } finally { clearTimeout(tm); }
}

/* ---------- Telegram Stars / Premium ---------- */
/* @username ni tozalab, Telegram qoidasiga tekshiramiz.
   DIQQAT: FazerCards da username ni tekshiradigan endpoint YO'Q.
   Mavjud, lekin BOSHQA odamning username i bo'lsa buyurtma muvaffaqiyatli bajariladi
   va qaytarilmaydi. Shuning uchun avval ilova bergan (Telegram tasdiqlagan) nom olinadi. */
function tgUser(o, who){
  const d = o.details || {};
  let u = String(d.username || d.user || d.telegram_username ||
                 o.username || o.nick || "").trim();
  if(!u && who && who.username) u = String(who.username);
  u = u.replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^@+/, "").trim();
  if(!/^[A-Za-z0-9_]{5,32}$/.test(u)) return "";
  return u;
}

/* Jonli kotirovka \u2014 kurs oshib ketsa zarariga sotmaslik uchun */
const UZS_USD = 12300;                 /* bufer kurs, index.html dagi hisob bilan bir xil */
const tgQ = { at:0, star:0, prem:{} }; /* 10 daqiqalik kesh */
async function tgQuotes(){
  if(Date.now() - tgQ.at < 600000) return true;
  const ac = new AbortController();
  const tm = setTimeout(()=>ac.abort(), 15000);
  try{
    const h = { "X-API-Key": FZR_KEY };
    const a = await fetch(FZR_BASE+"/api/v2/telegram/stars", { headers:h, signal:ac.signal });
    const ja = await a.json().catch(()=>({}));
    const b = await fetch(FZR_BASE+"/api/v2/telegram/premium", { headers:h, signal:ac.signal });
    const jb = await b.json().catch(()=>({}));
    if(!ja.ok || !jb.ok) return false;
    tgQ.star = Number(ja.price_per_star) || 0;   /* string bo'lib keladi */
    tgQ.prem = {};
    (jb.plans||[]).forEach(function(p){ tgQ.prem[String(p.months)] = Number(p.price_usd) || 0; });
    tgQ.at = Date.now();
    return true;
  }catch(e){ return false; }
  finally { clearTimeout(tm); }
}
/* narx tannarxni qoplamasa true qaytaradi (kotirovka olinmasa savdoni to'xtatmaymiz) */
async function tgTooCheap(kind, n, price){
  if(!(await tgQuotes())) return false;
  const usd = kind === "premium" ? (tgQ.prem[String(n)] || 0) : (tgQ.star * n);
  if(!(usd > 0)) return false;
  return price < Math.round(usd * UZS_USD);
}

async function fzrTg(kind, username, n){
  const ac = new AbortController();
  const tm = setTimeout(()=>ac.abort(), 25000);
  const url  = FZR_BASE + (kind === "premium"
                 ? "/api/v2/telegram/premium/buy" : "/api/v2/telegram/stars/buy");
  const body = kind === "premium"
                 ? { telegram_username: username, months: n }
                 : { telegram_username: username, quantity: n };
  try{
    const r = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "X-API-Key": FZR_KEY },
      body: JSON.stringify(body),
      signal: ac.signal
    });
    const j = await r.json().catch(()=>({}));
    /* muvaffaqiyat 201 keladi \u2014 r.ok 200..299 ni qamraydi */
    if(r.ok && j.ok){
      const id = j.order && j.order.id ? String(j.order.id) : "";
      if(!id) console.log("FZR TG: id yo'q, javob:", JSON.stringify(j));
      return { ok:true, id: id };
    }
    console.log("FZR TG rad:", r.status, JSON.stringify(j));
    return { ok:false, why: String(j.error || ("HTTP "+r.status)) };
  }catch(e){
    console.log("FZR TG xato:", e.message);
    return { ok:false, why:"network" };
  } finally { clearTimeout(tm); }
}

async function fzrStatus(id){
  const ac = new AbortController();
  const tm = setTimeout(()=>ac.abort(), 15000);
  try{
    const r = await fetch(FZR_BASE+"/api/v2/orders/"+encodeURIComponent(id), {
      headers:{ "X-API-Key": FZR_KEY }, signal: ac.signal
    });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || !j.ok || !j.order) return null;
    return j.order;
  }catch(e){ return null; }
  finally { clearTimeout(tm); }
}

/* ---------- Balans, buyurtma va to'ldirish ---------- */
const crypto = require("crypto");
const ADMIN_ID = String(process.env.ADMIN_ID || "");

/* ---------- To'lov kurslari ----------
   RATES faqat MIJOZ QANCHA TO'LASHINI belgilaydi (Sberbank rublda, Visa dollarda).
   Paket narxlariga TA'SIR QILMAYDI — ular so'mda, CATALOG da.
   Qiymatlar fxLoad() da bozor kursidan avtomatik yangilanadi;
   quyidagilar faqat boshlang'ich/zaxira. */
const RATES = { "so'm": 1, usd: 11500, rubl: 133 };

/* Bufer: bozordan shuncha PAST kurs qo'yamiz -> mijozdan biroz ko'proq
   valyuta so'raladi -> kurs sakrasa ham zarar bo'lmaydi. */
const FX_BUF = 0.973;
/* Aqlga sig'adigan chegara. Bundan tashqarida bo'lsa kurs QABUL QILINMAYDI
   (API buzilsa yoki g'alati son qaytarsa, narxlar buzilib ketmasin). */
const FX_SANE = { usd: [8000, 20000], rubl: [80, 260] };

function fxApply(usdPerSom, rubPerUsd){
  const out = [];
  const som = Number(usdPerSom);                 /* 1 USD = shuncha so'm */
  const rub = Number(rubPerUsd);                 /* 1 USD = shuncha rubl */
  if(som > 0){
    const v = Math.floor(som * FX_BUF);
    if(v >= FX_SANE.usd[0] && v <= FX_SANE.usd[1] && v !== RATES.usd){
      out.push("usd " + RATES.usd + " -> " + v); RATES.usd = v;
    }
  }
  if(som > 0 && rub > 0){
    const v = Math.floor(som / rub * FX_BUF);    /* 1 rubl = shuncha so'm */
    if(v >= FX_SANE.rubl[0] && v <= FX_SANE.rubl[1] && v !== RATES.rubl){
      out.push("rubl " + RATES.rubl + " -> " + v); RATES.rubl = v;
    }
  }
  if(out.length) console.log("Kurs yangilandi: " + out.join(", "));
}

/* ---------- USDT (TON tarmog'i) orqali to'ldirish ---------- */
const TON_KEY  = process.env.TON_KEY  || "";
const TON_ADDR = process.env.TON_ADDR || "";
/* Haqiqiy Tether USD jetton shartnomasi. Boshqa jetton QABUL QILINMAYDI \u2014
   aks holda kimdir soxta "USDT" yasab bepul balans to'ldirib olardi. */
const USDT_JETTON = "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe";
const USDT_DEC    = 1000000;          /* 6 kasrli: "2000000" = 2 USDT */
const TON_MIN     = 4;               /* eng kam to'lov, USDT */
const TON_RATE    = 11500;            /* 1 USDT = shuncha so'm (index.html bilan bir xil) */
const CARD_CUR = { "Humo":"so'm", "Sberbank":"rubl", "Visa":"usd" };
function payText(base, pay, bank){
  const cur = CARD_CUR[bank] || "so'm";
  const r = RATES[cur] || 1;
  if(r === 1) return pay + " so'm";
  const step = Math.round((pay - base) / 100);      /* 1, 2, 3 ... */
  const v = (Math.ceil(base / r * 100) / 100) + (step / 100);
  return v.toFixed(2) + " " + cur + "  (" + pay + " so'm balansga)";
}

/* Botga /start bosilganda ko'rinadigan salomlashuv */
/* DIQQAT: www BILAN. minatoh.uz -> www.minatoh.uz ga 308 yo'naltiradi va
   o'sha sakrashda iOS Telegram o'rnatgan TelegramWebviewProxy yo'qoladi \u2014
   shundan keyin openInvoice/openTelegramLink jimgina ishlamay qo'yadi. */
const APP_URL   = "https://www.minatoh.uz/";
const CHANNEL   = "https://t.me/savdo_mlbb1";
const SUPPORT   = "https://t.me/dv1mm_garant";
const BANNER    = "https://minatoh.uz/IMG_4477.PNG";

function checkInit(initData){
  try{
    if(!TOKEN || !initData) return null;
    const p = new URLSearchParams(String(initData));
    const hash = p.get("hash"); if(!hash) return null;
    p.delete("hash");
    const arr = [];
    p.forEach(function(v,k){ arr.push(k+"="+v); });
    arr.sort();
    const secret = crypto.createHmac("sha256","WebAppData").update(TOKEN).digest();
    const calc = crypto.createHmac("sha256", secret).update(arr.join("\n")).digest("hex");
    if(calc !== hash) return null;
    const ad = Number(p.get("auth_date")||0);
    if(!ad || (Date.now()/1000 - ad) > 86400) return null;
    const u = JSON.parse(p.get("user")||"null");
    if(!u || !u.id) return null;
    return { id:String(u.id), name:String(u.first_name||""), username:String(u.username||"") };
  }catch(e){ return null; }
}

function urec(db, id){
  if(!db[id]) db[id] = {};
  const u = db[id];
  if(typeof u.balance !== "number") u.balance = 0;
  if(!Array.isArray(u.orders)) u.orders = [];
  if(!Array.isArray(u.topups)) u.topups = [];
  return u;
}

/* javobni kutadigan variant \u2014 createInvoiceLink kabi natija kerak bo'lganda */
async function tgAsk(method, body){
  if(!TOKEN) return null;
  const ac = new AbortController();
  const tm = setTimeout(()=>ac.abort(), 15000);
  try{
    const r = await fetch("https://api.telegram.org/bot"+TOKEN+"/"+method, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(body), signal: ac.signal
    });
    return await r.json().catch(()=>null);
  }catch(e){ console.log("TG "+method+" xato:", e.message); return null; }
  finally { clearTimeout(tm); }
}

const pendTop = {};      /* /toldirish: admin -> kutilayotgan foydalanuvchi id */
function tgCall(method, body){
  if(!TOKEN) return;
  fetch("https://api.telegram.org/bot"+TOKEN+"/"+method, {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)
  }).catch(function(e){ console.log("TG "+method+" xato:", e.message); });
}

app.get("/balance", (req,res)=>{
  const db = load();
  const rec = db[String(req.query.id||"")];
  res.json({ ok:true, balance: (rec && rec.balance) || 0 });
});

/* Mini App "Telefon raqamini ulashish" tugmasi shu yerga uradi:
   bot foydalanuvchiga tugmali xabar yuboradi, keyin ilova yopiladi. */
app.post("/ask-phone", (req,res)=>{
  try{
    const who = checkInit((req.body||{}).initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const db = load();
    const u = db[who.id];
    if(u && u.phone) return res.json({ ok:true, already:true, phone:u.phone });
    send(who.id, "📱 Telefon raqamingizni ulashish uchun pastdagi tugmani bosing.", {
      keyboard: [[{ text: "📱 Raqamni ulashish", request_contact: true }]],
      resize_keyboard: true,
      is_persistent: true,
      one_time_keyboard: false
    });
    res.json({ ok:true });
  }catch(e){ console.log("ASKPHONE XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

/* ---------- Ilova ichidagi yozishmalar (spam cheklovi bo'lganlar uchun) ---------- */
app.post("/chat/list", (req,res)=>{
  try{
    const who = checkInit((req.body||{}).initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const db = load();
    const u = urec(db, who.id);
    if(!Array.isArray(u.chat)) u.chat = [];
    res.json({ ok:true, msgs: u.chat.slice(-60) });
  }catch(e){ console.log("CHATLIST XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

app.post("/chat/send", (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const text = String(b.text||"").trim().slice(0,1000);
    if(!text) return res.json({ ok:false, error:"empty" });
    const db = load();
    const u = urec(db, who.id);
    if(!Array.isArray(u.chat)) u.chat = [];
    const min = Date.now() - 60000;
    if(u.chat.filter(function(m){ return m.who==="user" && new Date(m.at).getTime() > min; }).length >= 12)
      return res.json({ ok:false, error:"busy" });
    u.chat.push({ who:"user", text:text, at:new Date().toISOString() });
    u.chat = u.chat.slice(-100);
    save(db);
    if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "\uD83D\uDCAC "+who2(who)+"\nid: "+who.id+"\n\n"+text+
            "\n\n\u2199\uFE0F Javob berish uchun shu xabarga REPLY qiling" });
    res.json({ ok:true });
  }catch(e){ console.log("CHATSEND XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

function adminReply(msg){
  try{
    const rt = msg.reply_to_message;
    if(!rt || !rt.text) return false;
    const m = rt.text.match(/^id:\s*(\d+)$/m);
    if(!m) return false;
    const uid = m[1];
    const text = String(msg.text||"").trim();
    if(!text) return false;
    const db = load();
    const u = urec(db, uid);
    if(!Array.isArray(u.chat)) u.chat = [];
    u.chat.push({ who:"admin", text:text, at:new Date().toISOString() });
    u.chat = u.chat.slice(-100);
    save(db);
    send(uid, "\uD83D\uDCAC Qo'llab-quvvatlashdan javob keldi:\n\n"+text+
               "\n\nIlovadagi Chat bo'limida davom ettirishingiz mumkin.");
    send(ADMIN_ID, "\u2705 Yuborildi");
    return true;
  }catch(e){ console.log("REPLY XATO:", e.message); return false; }
}

app.get("/orders", (req,res)=>{
  const db = load();
  const rec = db[String(req.query.id||"")];
  res.json({ ok:true, orders:(rec && rec.orders) || [], topups:(rec && rec.topups) || [] });
});

app.post("/order", async (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const uid  = who.id;
    const o    = b.order || {};
    const game = gameKey(o);
    const oid  = String(o.oid||"");
    const acc  = String(o.accRegion||"");

    /* Yangi o'yinlar: ilova cat (kategoriya) yuboradi, narx games.json dan olinadi */
    const ncat = String(o.cat || "");
    const nEnt = ncat ? GIDX[ncat + "|" + oid] : null;

    /* TG Stars: paket emas, mijoz kiritgan miqdor */
    let stars = 0;
    if(game === "tgstars" && !nEnt){
      stars = starsQty(o);
      if(!stars){
        console.log("STARS: miqdor topilmadi, kelgan obyekt:", JSON.stringify(o));
        return res.json({ ok:false, error:"fields" });
      }
      if(stars < STARS_MIN || stars > STARS_MAX)
        return res.json({ ok:false, error:"qty", min:STARS_MIN, max:STARS_MAX });
    }
    const off = nEnt
      ? { cat: ncat, price: nEnt.price, srv:false, tg:"" }
      : stars
        ? { cat:"telegram_stars", price: starsPrice(stars), srv:false, tg:"stars" }
        : resolveOffer(game, oid, acc);

    /* narxni server belgilaydi; katalogda yo'q narsalar qo'lda qoladi */
    const auto = !!off;
    const tg = auto ? off.tg : "";
    const price = auto ? off.price : Math.round(Number(o.price) || 0);
    if(!(price > 0)) return res.json({ ok:false, error:"price" });

    const fields = nEnt ? catFields(nEnt.fields, o).fields
                 : tg   ? {}
                        : fzrFields(game, o);
    let tgu = "", tgn = 0;

    if(nEnt){
      const chk = catFields(nEnt.fields, o);
      if(chk.missing) return res.json({ ok:false, error:"fields", need: chk.missing });
      if(price < nEnt.cost){
        console.log("YANGI O'YIN narx past:", ncat, oid, price, "<", nEnt.cost);
        return res.json({ ok:false, error:"rate" });
      }
    } else if(tg){
      tgu = tgUser(o, who);
      if(!tgu) return res.json({ ok:false, error:"username" });
      tgn = stars || Number(String(oid).split("_")[1] || 0);
      if(!(tgn > 0)) return res.json({ ok:false, error:"fields" });
      if(tg === "stars" && (tgn < STARS_MIN || tgn > STARS_MAX))
        return res.json({ ok:false, error:"qty" });
      if(await tgTooCheap(tg, tgn, price)){
        console.log("TG narx past:", oid, price);
        if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
          text: "\u26a0\ufe0f Kurs oshdi \u2014 "+oid+" tannarxdan arzon sotilyapti ("+price+" so'm).\nBuyurtma to'xtatildi. Narxni yangilang." });
        return res.json({ ok:false, error:"rate" });
      }
    } else if(auto){
      if(!fields.player_id) return res.json({ ok:false, error:"fields" });
      if(off.srv && !fields.server_id){
        console.log("ORDER: server_id topilmadi, kelgan obyekt:", JSON.stringify(o));
        return res.json({ ok:false, error:"fields" });
      }
      /* Cheklovlar faqat Global kategoriyaga tegishli; RU kategoriyasida hammasi ishlaydi */
      if(game === "mlbb" && off.cat === "mobile_legends_global"){
        const reg = acc.toLowerCase();
        if(MLBB_BLOCKED_REG.indexOf(reg) >= 0) return res.json({ ok:false, error:"region" });
        if(MLBB_LIMITED.indexOf(oid) >= 0 && MLBB_LIMITED_REG.indexOf(reg) >= 0)
          return res.json({ ok:false, error:"region" });
      }
    }

    const db = load();
    const u = urec(db, uid);
    if(u.balance < price) return res.json({ ok:false, error:"balance", balance:u.balance, need:price });

    u.balance -= price;
    const rec = {
      id: String(o.id || ("MT"+Date.now().toString().slice(-8))),
      game: String(o.game||""), gkey: game, gameId: String(o.gameId||""),
      pid: tg ? ("@"+tgu)
          : (fields.player_id || fields.user_id || fields.riot_id ||
             fields.character_id || Object.values(fields)[0] || ""),
      srv: fields.server_id || fields.zone_id || fields.server || "",
      tg: tg, tgq: tgn,
      package: String(o.package || (stars ? (stars + " \u2b50") : "")), price: price,
      details: o.details || {}, region: o.region || null,
      nick: String(o.nick||""), accRegion: String(o.accRegion||""),
      oid: oid, cat: auto ? off.cat : "", auto: auto,
      fzr: "", status: "wait", at: new Date().toISOString()
    };
    u.orders.unshift(rec); u.orders = u.orders.slice(0,100);
    save(db);

    const det = Object.keys(rec.details).map(function(k){ return k+": "+rec.details[k]; }).join("\n");
    if(ADMIN_ID) tgCall("sendMessage", Object.assign({ chat_id: ADMIN_ID,
      text: (auto ? "🤖 AVTO BUYURTMA " : "🧾 QO'LDA BUYURTMA ")+rec.id+"\n"+rec.game+" — "+rec.package+"\n"+
            (rec.nick ? ("👤 "+rec.nick+(rec.accRegion?" ("+rec.accRegion+")":"")+"\n") : "")+
            det+"\n💰 "+rec.price+" so'm\n👥 id: "+uid+"\nQoldiq: "+u.balance },
      auto ? {} : { reply_markup: { inline_keyboard: [[
        { text: "\u2705 Bajarildi", callback_data: "od_ok:"+uid+":"+rec.id },
        { text: "\u274C Bekor + pul", callback_data: "od_no:"+uid+":"+rec.id }
      ]]}}));

    if(!auto){
      send(uid, "✅ Buyurtma qabul qilindi: "+rec.package+"\nTez orada bajariladi.\nQoldiq balans: "+u.balance+" so'm");
      return res.json({ ok:true, balance:u.balance, order:rec });
    }

    /* Yetkazib beruvchiga yuboramiz \u2014 coindrop yoki FazerCards */
    const cdGame = CD_GAMES[game];
    const r = cdGame
      ? await cdCreate(cdGame, rec.oid, rec.pid, rec.id)
      : (tg ? await fzrTg(tg, tgu, tgn)
            : await fzrCreate(rec.cat, rec.oid, fields, "mt-" + rec.id));

    const db2 = load();
    const u2 = urec(db2, uid);
    const rec2 = u2.orders.find(function(x){ return x.id === rec.id; }) || rec;

    if(r.ok){
      rec2.fzr = r.id; rec2.status = "sent";
      if(cdGame) rec2.cd = 1;                    /* kim yuborganini eslab qolamiz */
      save(db2);
      /* id kelmasa sweep uni kuzata olmaydi \u2014 pulni QAYTARMAYMIZ (buyurtma qabul qilingan) */
      if(!r.id && ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
        text: "\u2757 "+rec.id+" yuborildi, lekin FZR id qaytarmadi.\n"+rec.package+" \u2014 "+rec.pid+"\nPanelda qo'lda tekshiring." });
      send(uid, "⏳ Buyurtma yuborildi: "+rec.package+"\nOdatda 1-2 daqiqada tushadi.\nQoldiq balans: "+u2.balance+" so'm");
      return res.json({ ok:true, balance:u2.balance, order:rec2 });
    }

    /* rad etildi — pulni darrov qaytaramiz */
    u2.balance += rec2.price;
    rec2.status = "refund"; rec2.fail = r.why;
    save(db2);
    send(uid, "❌ Buyurtmani bajarib bo'lmadi. "+rec2.price+" so'm balansga qaytarildi.\nJoriy balans: "+u2.balance+" so'm");
    if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "⚠️ "+(cdGame ? "coindrop" : "FZR")+" rad etdi: "+r.why+"\n"+rec.package+" — id "+uid+"\nQaytarildi: "+rec2.price+" so'm" });
    res.json({ ok:false, error:"supplier", balance:u2.balance });

  }catch(e){ console.log("ORDER XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

/* ---------- Tugallanmagan buyurtmalarni kuzatish ---------- */
async function checkOne(uid, ordId){
  const d0 = load();
  const u0 = d0[uid]; if(!u0 || !Array.isArray(u0.orders)) return;
  const r0 = u0.orders.find(function(x){ return x.id === ordId; });
  /* "stuck" ham tekshiriladi — aks holda tarmoq uzilgan paytda osilib qolgan
     buyurtma abadiy tekshirilmay qoladi va mijozning puli qaytmaydi */
  if(!r0 || !r0.fzr || (r0.status !== "sent" && r0.status !== "stuck")) return;

  /* --- coindrop buyurtmasi bo'lsa alohida yo'l --- */
  if(r0.cd){
    const cs = await cdStatus(r0.fzr);
    if(!cs.done && !cs.failed){
      if(Date.now() - new Date(r0.at).getTime() > 30*60000 && !r0.warned){
        const dW = load(); const uW = urec(dW, uid);
        const rW = uW.orders.find(function(x){ return x.id === ordId; });
        if(rW){ rW.status = "stuck"; rW.warned = true; save(dW);
          if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
            text: "\u23F0 coindrop 30 daq tugamadi: "+rW.fzr+"\n"+rW.package+" \u2014 id "+uid });
        }
      }
      return;
    }
    const dC = load(); const uC = urec(dC, uid);
    const rC = uC.orders.find(function(x){ return x.id === ordId; });
    if(!rC || (rC.status !== "sent" && rC.status !== "stuck")) return;
    if(cs.done){
      rC.status = "done"; rC.doneAt = new Date().toISOString();
      save(dC);
      send(uid, "\u2705 "+rC.package+" hisobingizga tushdi!\nID: "+(rC.pid||""));
    } else {
      uC.balance += rC.price;
      rC.status = "refund"; rC.fail = cs.why || "coindrop rad etdi";
      save(dC);
      send(uid, "\u274C Buyurtma bajarilmadi. "+rC.price+" so'm balansga qaytarildi.\nJoriy balans: "+uC.balance+" so'm");
      if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
        text: "\u26A0\uFE0F coindrop rad etdi: "+(cs.why||"-")+"\n"+rC.package+" \u2014 id "+uid+"\nQaytarildi: "+rC.price+" so'm" });
    }
    return;
  }

  const st = await fzrStatus(r0.fzr);
  if(!st) return;
  const s = String(st.status||"").toLowerCase();

  const db = load();
  const u = urec(db, uid);
  const r = u.orders.find(function(x){ return x.id === ordId; });
  if(!r || (r.status !== "sent" && r.status !== "stuck")) return;

  if(s === "completed"){
    r.status = "done"; r.doneAt = new Date().toISOString();
    save(db);
    send(uid, "✅ "+r.package+" hisobingizga tushdi!\nID: "+(r.pid || r.gameId || ""));
    return;
  }
  if(s === "failed" || s === "cancelled" || s === "canceled" || s === "refunded"){
    u.balance += r.price;
    r.status = "refund"; r.fail = String(st.fail_reason||"");
    save(db);
    send(uid, "❌ Buyurtma bajarilmadi. "+r.price+" so'm balansga qaytarildi.\nJoriy balans: "+u.balance+" so'm");
    if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "⚠️ FZR fail "+r.fzr+"\n"+(st.fail_reason||"-")+"\n"+r.package+" — id "+uid+"\nQaytarildi: "+r.price+" so'm" });
    return;
  }
  if(Date.now() - new Date(r.at).getTime() > 30*60000){
    r.status = "stuck";
    const yangi = !r.warned;      /* ogohlantirish faqat bir marta */
    r.warned = true;
    save(db);
    if(ADMIN_ID && yangi) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "⏰ 30 daqiqadan beri tugamadi: "+r.fzr+"\n"+r.package+" — id "+uid+"\nTekshirish davom etadi." });
  }
}

async function sweep(){
  try{
    const db = load();
    const jobs = [];
    let changed = false;
    Object.keys(db).forEach(function(uid){
      const u = db[uid];
      if(!u || !Array.isArray(u.orders)) return;
      u.orders.forEach(function(r){
        if((r.status === "sent" || r.status === "stuck") && r.fzr){
          /* 7 kundan eski bo'lsa cheksiz so'ramaymiz */
          if(Date.now() - new Date(r.at).getTime() < 7*24*3600000) jobs.push([uid, r.id]);
          return;
        }
        /* yuborilmay osilib qolgan (server o'chib qolgan bo'lsa) — pulni qaytaramiz */
        if(r.status === "wait" && r.auto && !r.fzr &&
           Date.now() - new Date(r.at).getTime() > 300000){
          if(typeof u.balance !== "number") u.balance = 0;
          u.balance += r.price;
          r.status = "refund"; r.fail = "yuborilmadi";
          changed = true;
          send(uid, "↩️ Buyurtma yuborilmadi, "+r.price+" so'm balansga qaytarildi.");
        }
      });
    });
    if(changed) save(db);
    for(let i = 0; i < jobs.length; i++){ await checkOne(jobs[i][0], jobs[i][1]); }
  }catch(e){ console.log("SWEEP xato:", e.message); }
}
setInterval(sweep, 30000);

/* ---------- Valyuta kurslari ----------
   HECH QANDAY kurs qo'lda yozilmagan \u2014 server ularni o'zi oladi va
   6 soatda bir yangilaydi. FX_FALLBACK faqat internet uzilganda ishlaydi
   va taxminiy; u ishlatilganda log'da ogohlantirish chiqadi. */
let FX = { at: 0, live: false, usd: {} };
const FX_FALLBACK = { USD:1, RUB:86.4, KZT:462, KGS:87.4, TRY:48.1, EUR:0.861,
                      BRL:5.18, IDR:17710, VND:25600, CNY:6.72, JPY:160, KRW:1376, UZS:12200 };
async function fxLoad(){
  try{
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const d = await r.json();
    if(d && d.rates && d.rates.KRW && d.rates.RUB){
      FX = { at: Date.now(), live: true, usd: d.rates };
      console.log("FX yangilandi: KRW="+d.rates.KRW+" RUB="+d.rates.RUB);
      /* To'lov kurslarini ham yangilaymiz.
         d.rates.UZS = 1 USD nechchi so'm, d.rates.RUB = 1 USD nechchi rubl */
      fxApply(d.rates.UZS, d.rates.RUB);
      return;
    }
    console.log("FX: javob kutilgandek emas");
  }catch(e){ console.log("FX xato:", e.message); }
  if(!FX.at){
    FX = { at: Date.now(), live: false, usd: FX_FALLBACK };
    console.log("\u26A0\uFE0F FX: zaxira kurslar ishlatilyapti \u2014 taxminiy!");
  }
}
fxLoad();
setInterval(fxLoad, 6*3600*1000);

/* Ilova shu yerdan kurslarni oladi. som = 1 USD nechchi so'm (11500).
   USDT to'ldirish bilan BIR XIL kurs \u2014 shunda mijozning hisobi izchil bo'ladi. */
app.get("/fx", (req,res)=>{
  res.json({ ok:true, som: TON_RATE, live: FX.live, at: FX.at, usd: FX.usd, rates: RATES });
});

/* ---------- USDT (TON) to'lovlarini blokcheyndan o'qish ----------
   Har 30 soniyada oxirgi hodisalar o'qiladi. Mos memo topilsa balans to'ldiriladi.
   event_id data.json da saqlanadi \u2014 shuning uchun server o'chib qayta yonsa ham
   bitta to'lov ikki marta hisoblanmaydi. */

function tonSeen(db){
  if(!db._ton || !Array.isArray(db._ton.seen)) db._ton = { seen: [] };
  return db._ton;
}

async function tonCheck(){
  if(!TON_KEY || !TON_ADDR) return;
  let ev;
  try{
    const r = await fetch("https://tonapi.io/v2/accounts/"+TON_ADDR+"/events?limit=30",
      { headers: { "Authorization": "Bearer "+TON_KEY } });
    if(!r.ok){ console.log("TON API:", r.status); return; }
    ev = await r.json();
  }catch(e){ console.log("TON xato:", e.message); return; }

  const events = (ev && ev.events) || [];
  if(!events.length) return;

  const db = load();
  const st = tonSeen(db);
  let changed = false;

  for(const e of events){
    if(e.in_progress) continue;                       /* hali tugamagan */
    if(st.seen.indexOf(e.event_id) > -1) continue;    /* allaqachon hisoblangan */

    for(const a of (e.actions || [])){
      if(a.type !== "JettonTransfer" || a.status !== "ok") continue;
      const j = a.JettonTransfer || {};
      if(!j.jetton || j.jetton.address !== USDT_JETTON) continue;   /* faqat haqiqiy USDT */
      if(!j.recipients_wallet && !j.recipient) continue;

      const memo = String(j.comment || "").trim().toLowerCase();
      const usdt = Number(j.amount || 0) / USDT_DEC;
      if(!memo || !(usdt > 0)) continue;

      /* memo bo'yicha kutilayotgan to'ldirishni topamiz */
      let uid = "", rec = null;
      Object.keys(db).forEach(function(k){
        if(!/^\d+$/.test(k)) return;
        (db[k].topups || []).forEach(function(t){
          if(t.status === "wait" && t.memo && t.memo.toLowerCase() === memo){ uid = k; rec = t; }
        });
      });

      st.seen.push(e.event_id);
      if(st.seen.length > 400) st.seen.shift();
      changed = true;

      if(!rec){
        if(ADMIN_ID) send(ADMIN_ID, "\u26A0\uFE0F USDT keldi: "+usdt.toFixed(2)+
          "\nMemo: "+(j.comment||"(bo'sh)")+"\nMos to'ldirish topilmadi \u2014 QO'LDA ko'ring.");
        continue;
      }
      if(usdt + 0.01 < TON_MIN){
        if(ADMIN_ID) send(ADMIN_ID, "\u26A0\uFE0F USDT "+usdt.toFixed(2)+" (memo "+memo+
          ") eng kam summadan kam \u2014 QO'LDA ko'ring.");
        continue;
      }

      /* Kelgan summani hisoblaymiz \u2014 e'lon qilinganini emas.
         Ko'proq yuborsa ko'proq, ozroq yuborsa ozroq tushadi. */
      const som = Math.floor(usdt * TON_RATE);
      const u = urec(db, uid);
      if(typeof u.balance !== "number") u.balance = 0;
      rec.status = "done";
      rec.auto   = true;
      rec.usdt   = usdt;
      rec.amount = som;
      u.balance += som;

      send(uid, "\u2705 Balansingiz to'ldirildi: +"+som+" so'm ("+usdt.toFixed(2)+
        " USDT)\nJoriy balans: "+u.balance+" so'm");
      if(ADMIN_ID) send(ADMIN_ID, "\uD83E\uDD16 AVTO TASDIQ (USDT) "+rec.id+
        "\nKelgan: "+usdt.toFixed(2)+" USDT"+
        "\nMemo: "+memo+
        "\nBalansga: "+som+" so'm"+
        "\nKimga: "+(rec.who || uid)+
        "\nYangi balans: "+u.balance);
    }
  }
  if(changed) save(db);
}
/* sweep() ham 30 soniyada ishlaydi. Ikkalasi bir vaqtda yozmasligi uchun
   tonCheck 15 soniyaga suriladi \u2014 aynan shu to'qnashuv bazani yo'q qilgan edi. */
setTimeout(function(){ tonCheck(); setInterval(tonCheck, 30000); }, 15000);

function who2(w){ return w.name + (w.username ? " (@"+w.username+")" : ""); }
function esc(t){ return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function expireOld(db){
  const lim = Date.now() - 24*3600*1000;
  let ch = false;
  Object.keys(db).forEach(function(k){
    const t = db[k] && db[k].topups;
    if(!Array.isArray(t)) return;
    t.forEach(function(x){
      if(x.status === "wait" && new Date(x.at).getTime() < lim){ x.status = "expired"; ch = true; }
    });
  });
  return ch;
}

function usedAmounts(db){
  const set = new Set();
  Object.keys(db).forEach(function(k){
    const t = db[k] && db[k].topups;
    if(Array.isArray(t)) t.forEach(function(x){ if(x.status === "wait" && !x.memo) set.add(x.amount); });
  });
  return set;
}

/* ---------- Telegram Stars orqali balansni to'ldirish ----------
   Mijoz yulduz to'laydi, balansiga so'm tushadi. Ixtiyoriy miqdor.

   ZARARGA KIRMASLIK: Telegram olingan yulduzni Fragment orqali ~$0.013 ga
   yechishga ruxsat beradi. 11 500 kursda bu ~149 so'm, Fragment/birja
   xarajatlari ~3% ni olib tashlasak ~145 so'm. Shuning uchun quyidagi
   STAR_TOPUP_RATE 145 dan PAST bo'lishi SHART, aks holda har to'ldirishda
   zarar ko'rasiz. 140 = yulduzga ~5 so'm foyda.
   Eslatma: yechish uchun eng kami 1 000 yulduz to'planishi va har to'lovdan
   keyin 21 kun o'tishi kerak \u2014 bu pul darrov aylanmaga tushmaydi. */
const STAR_TOPUP_RATE = 140;      /* 1 yulduz = shuncha so'm balansga */
const STAR_TOPUP_MIN  = 10;       /* juda mayda to'lovlarni to'sish uchun */
const STAR_TOPUP_MAX  = 100000;

app.post("/star-invoice", async (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const n = Math.floor(Number(b.stars) || 0);
    if(!(n >= STAR_TOPUP_MIN && n <= STAR_TOPUP_MAX))
      return res.json({ ok:false, error:"qty", min:STAR_TOPUP_MIN, max:STAR_TOPUP_MAX });

    const som = n * STAR_TOPUP_RATE;
    const inv = {
      title: "Balansni to'ldirish",
      description: n + " Stars = " + som + " so'm balansingizga qo'shiladi",
      payload: "star:" + who.id + ":" + n,
      provider_token: "",
      currency: "XTR",
      prices: [{ label: n + " Stars", amount: n }]
    };

    /* send:true \u2014 zaxira yo'l: hisob-fakturani bot chatiga xabar qilib yuboramiz */
    if(b.send){
      const s = await tgAsk("sendInvoice", Object.assign({ chat_id: who.id }, inv));
      if(!s || !s.ok){
        console.log("STAR sendInvoice xato:", JSON.stringify(s));
        return res.json({ ok:false, error:"invoice" });
      }
      return res.json({ ok:true, sent:true, som: som, stars: n });
    }

    const j = await tgAsk("createInvoiceLink", inv);
    if(!j || !j.ok || !j.result){
      console.log("STAR invoice xato:", JSON.stringify(j));
      return res.json({ ok:false, error:"invoice" });
    }
    res.json({ ok:true, link: j.result, som: som, stars: n });
  }catch(e){ console.log("STAR INVOICE XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

app.get("/star-rate", (req,res)=>{
  res.json({ ok:true, rate:STAR_TOPUP_RATE, min:STAR_TOPUP_MIN, max:STAR_TOPUP_MAX });
});

/* To'lov muvaffaqiyatli \u2014 balansni qo'shamiz.
   charge_id takrorlansa qayta qo'shmaymiz (Telegram xabarni qayta yuborishi mumkin). */
function starPaid(fromId, sp){
  const stars  = Math.floor(Number(sp.total_amount) || 0);
  const charge = String(sp.telegram_payment_charge_id || "");
  if(!(stars > 0)) return;

  const db = load();
  const u = urec(db, fromId);
  if(charge && u.topups.some(function(t){ return t.charge === charge; })) return;

  const som = stars * STAR_TOPUP_RATE;
  const id  = "ST" + Date.now().toString().slice(-8);
  u.balance += som;
  u.topups.unshift({ id:id, amount:som, base:som, method:"Telegram Stars",
                     stars:stars, charge:charge, status:"ok",
                     at:new Date().toISOString(), doneAt:new Date().toISOString() });
  u.topups = u.topups.slice(0,60);
  save(db);

  send(fromId, "\u2b50 " + stars + " Stars qabul qilindi!\nBalansingizga " + som +
               " so'm qo'shildi.\nJoriy balans: " + u.balance + " so'm");
  if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
    text: "\u2b50 STARS TO'LDIRISH " + id + "\n" + stars + " Stars = " + som +
          " so'm\nid: " + fromId + "\nYangi balans: " + u.balance });
}

/* ---------- Karta orqali to'ldirish (noyob summa bilan) ---------- */
/* ---------- Referal: kim kimni taklif qilgan ----------
   BONUS BERILMAYDI — faqat kuzatuv. Bonus keyinroq qo'shiladi. */
app.post("/ref", (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const uid = String(who.id);
    const by  = String(b.ref || "").replace(/\D/g,"");

    const db = load();
    const u  = urec(db, uid);
    /* ismni har doim yangilab boramiz — ro'yxatda ko'rinishi uchun */
    let ch = false;
    if(u.nm !== who.name){ u.nm = who.name; ch = true; }
    const un = String(who.username||"").toLowerCase();
    if(u.un !== un){ u.un = un; ch = true; }

    if(by && by !== uid && !u.refBy){
      const inv = urec(db, by);
      u.refBy = by;
      u.refAt = new Date().toISOString();
      if(!Array.isArray(inv.refs)) inv.refs = [];
      if(inv.refs.indexOf(uid) < 0) inv.refs.push(uid);
      ch = true;
      if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
        text: "\uD83D\uDC65 YANGI REFERAL\n" + who2(who) + " (id " + uid + ")\n" +
              "Taklif qilgan: " + (inv.nm || by) + (inv.un ? " (@"+inv.un+")" : "") + " (id " + by + ")" });
    }
    if(ch) save(db);
    res.json({ ok:true, refBy: u.refBy || "" });
  }catch(e){ res.json({ ok:false, error:"server" }); }
});

/* Taklif qilinganlar ro'yxati */
app.get("/refs", (req,res)=>{
  try{
    const uid = String(req.query.id || "").replace(/\D/g,"");
    if(!uid) return res.json({ ok:false, error:"id" });
    const db = load();
    const u  = db[uid] || {};
    const ids = Array.isArray(u.refs) ? u.refs : [];
    const list = ids.map(function(k){
      const r = db[k] || {};
      return { id:k, nm:r.nm || "", un:r.un || "", at:r.refAt || "",
               orders:(r.orders||[]).filter(function(x){ return x.status==="done"; }).length };
    });
    list.sort(function(a,b){ return String(b.at||"").localeCompare(String(a.at||"")); });
    res.json({ ok:true, count:list.length, list:list.slice(0,100) });
  }catch(e){ res.json({ ok:false, error:"server" }); }
});

app.post("/topup", (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const uid = who.id;
    const base = Math.round(Number(b.amount) || 0);
    if(!(base >= 1000) || base > 50000000) return res.json({ ok:false, error:"amount" });

    const db = load();
    expireOld(db);
    const u = urec(db, uid);
    if(u.topups.filter(function(t){ return t.status==="wait"; }).length >= 3)
      return res.json({ ok:false, error:"pending" });

    /* --- USDT (TON): noyob summa emas, noyob MEMO beriladi --- */
    if(/usdt|ton/i.test(String(b.method || ""))){
      if(!TON_ADDR) return res.json({ ok:false, error:"off" });
      const usdt = Math.ceil(base / TON_RATE * 100) / 100;
      if(usdt + 0.001 < TON_MIN) return res.json({ ok:false, error:"min", min:TON_MIN });

      const busy = new Set();
      Object.keys(db).forEach(function(k){
        if(!/^\d+$/.test(k)) return;
        (db[k].topups || []).forEach(function(t){ if(t.status === "wait" && t.memo) busy.add(t.memo); });
      });
      let memo = "";
      for(let i = 0; i < 20; i++){
        const m = "mt-" + crypto.randomBytes(3).toString("hex");
        if(!busy.has(m)){ memo = m; break; }
      }
      if(!memo) return res.json({ ok:false, error:"busy" });

      const tid = "TP" + Date.now().toString().slice(-8);
      u.topups.unshift({ id:tid, amount:base, base:base, method:String(b.method||""),
                         memo:memo, usdtWant:usdt, status:"wait",
                         at:new Date().toISOString(), who:who2(who) });
      u.topups = u.topups.slice(0,60);
      save(db);

      if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
        text: "\uD83D\uDCB3 TO'LDIRISH " + tid + " (USDT)" +
              "\nKutilmoqda: " + usdt.toFixed(2) + " USDT (" + base + " so'm)" +
              "\nMemo: " + memo +
              "\nKimdan: " + who2(who) + "\nid: " + uid +
              "\nJoriy balans: " + u.balance +
              "\n\nAvtomatik tasdiqlanadi \u2014 tugma kerak emas." });

      return res.json({ ok:true, id:tid, memo:memo, usdt:usdt.toFixed(2),
                        addr:TON_ADDR, min:TON_MIN });
    }

    const used = usedAmounts(db);
    let pay = 0;
    /* Noyob farq 100 so'mlik qadamlar bilan \u2014 bank SMS'ida aniq ko'rinadi */
    for(let n = 1; n <= 60; n++){ if(!used.has(base + n*100)){ pay = base + n*100; break; } }
    if(!pay) return res.json({ ok:false, error:"busy" });

    const id = "TP"+Date.now().toString().slice(-8);
    u.topups.unshift({ id:id, amount:pay, base:base, method:String(b.method||""),
                       status:"wait", at:new Date().toISOString(),
                       who:who2(who) });
    u.topups = u.topups.slice(0,60);
    save(db);

    if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "💳 TO'LDIRISH "+id+
            "\nAYNAN: "+payText(base, pay, String(b.method||""))+
            "\nKimdan: "+who2(who)+
            "\nid: "+uid+
            "\nUsul: "+(b.method||"-")+
            "\nJoriy balans: "+u.balance,
      reply_markup: { inline_keyboard: [[
        { text:"✅ Tasdiqlash", callback_data:"tp_ok:"+uid+":"+id },
        { text:"❌ Rad etish",  callback_data:"tp_no:"+uid+":"+id }
      ]] } });

    res.json({ ok:true, id:id, pay:pay });
  }catch(e){ console.log("TOPUP XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

/* Mijoz "To'ladim" bosgach ilova shu yerdan holatni kuzatadi.
   SMS avtomatik tasdiqlasa status "done" bo'ladi va balans qaytariladi. */
app.post("/topup-status", (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const db = load();
    const u  = urec(db, who.id);
    const t  = (u.topups || []).find(function(x){ return x.id === String(b.id||""); });
    if(!t) return res.json({ ok:false, error:"yoq" });
    res.json({ ok:true, status: t.status, balance: u.balance, auto: !!t.auto });
  }catch(e){ res.json({ ok:false, error:"server" }); }
});

/* Mijoz "Bekor qilish" bosganda yoki 10 daqiqa tugaganda */
app.post("/topup-cancel", (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const id = String(b.id||"");
    const db = load();
    const u = urec(db, who.id);
    const t = u.topups.find(function(x){ return x.id === id; });
    if(!t) return res.json({ ok:false, error:"notfound" });
    if(t.status !== "wait") return res.json({ ok:true, already:true });
    t.status = "cancel";
    save(db);
    if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "\u274C TO'LDIRISH "+id+" bekor qilindi\nSumma: "+t.amount+" so'm\nKimdan: "+(t.who||who.id) });
    res.json({ ok:true });
  }catch(e){ console.log("TOPCANCEL XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

/* ---------- Hammaga xabar tarqatish (faqat admin) ---------- */
/*  /xabar  \u2014 bitta rasm + "Xaridni boshlash" tugmasi
    /bonus  \u2014 bitta rasm + "Bonus olish" tugmasi
    /oyin   \u2014 bitta rasm + "Yangi o'yinlarni ko'rish" tugmasi
    /yangi  \u2014 bitta rasm + "Yangilikni sinab ko'rish" tugmasi
    /albom  \u2014 bir nechta rasm, tugmasiz (Telegram albomga tugma qo'ymaydi)
    /ochir  \u2014 oxirgi tarqatishni HAMMADAN o'chirish (48 soat ichida)  */

let bcast = { armed:false, mode:"btn", kind:null, text:"", photo:"", ents:null,
              album:[], grp:null, timer:null };

function bcastReset(){
  if(bcast.timer) clearTimeout(bcast.timer);
  bcast = { armed:false, mode:"btn", kind:null, text:"", photo:"", ents:null,
            album:[], grp:null, timer:null };
}

function bcastTargets(){
  const db = load();
  return Object.keys(db).filter(function(k){ return /^\d+$/.test(k); });
}

function bcastKb(mode){
  if(mode === "plain") return undefined;
  const L = { bonus: "\uD83C\uDF81 Bonus olish",
              oyin:  "\uD83C\uDFAE Yangi o'yinlarni ko'rish",
              yangi: "\u2728 Yangilikni sinab ko'rish" };
  const label = L[mode] || "\uD83D\uDE80 Xaridni boshlash";
  return { inline_keyboard: [[ { text: label, web_app: { url: APP_URL } } ]] };
}

function bcastAsk(){
  const n = bcastTargets().length;
  const what = bcast.kind === "album" ? (bcast.album.length + " ta rasm")
             : bcast.kind === "photo" ? "rasm" : "matn";
  const btn  = bcast.mode === "plain" ? "tugmasiz"
             : bcast.mode === "bonus" ? "\uD83C\uDF81 Bonus olish tugmasi bilan"
             : bcast.mode === "oyin"  ? "\uD83C\uDFAE Yangi o'yinlar tugmasi bilan"
             : bcast.mode === "yangi" ? "\u2728 Yangilik tugmasi bilan"
             : "\uD83D\uDE80 Xaridni boshlash tugmasi bilan";
  tgCall("sendMessage", { chat_id: ADMIN_ID,
    text: "\uD83D\uDCE2 " + what + " (" + btn + ")\n" + n + " ta foydalanuvchiga yuborilsinmi?",
    reply_markup: { inline_keyboard: [[
      { text: "\u2705 Ha, yuborilsin", callback_data: "bc_ok" },
      { text: "\u274C Yo'q", callback_data: "bc_no" }
    ]]}});
}

function doBroadcast(){
  const ids  = bcastTargets();
  const kind = bcast.kind, mode = bcast.mode, text = bcast.text,
        photo = bcast.photo, ents = bcast.ents, album = bcast.album.slice();
  bcastReset();

  const kb = bcastKb(mode);
  let ok = 0, fail = 0, i = 0;
  const sent = [];                       /* o'chirish uchun saqlanadi */
  send(ADMIN_ID, "\uD83D\uDCE4 Yuborilmoqda\u2026 (" + ids.length + " ta)");

  function step(){
    if(i >= ids.length){
      const db = load();
      db._bcast = { at: new Date().toISOString(), items: sent };
      save(db);
      send(ADMIN_ID, "\u2705 Tugadi\nYuborildi: " + ok + "\nYetib bormadi: " + fail +
                     "\n\nHammadan o'chirish uchun: /ochir");
      return;
    }
    const uid = ids[i++];
    let method, body;
    if(kind === "album"){
      method = "sendMediaGroup";
      body = { chat_id: uid, media: album.map(function(fid, n){
        return n === 0
          ? { type:"photo", media:fid, caption:text, caption_entities: ents || undefined }
          : { type:"photo", media:fid };
      })};
    } else if(kind === "photo"){
      method = "sendPhoto";
      body = { chat_id: uid, photo: photo, caption: text,
               caption_entities: ents || undefined, reply_markup: kb };
    } else {
      method = "sendMessage";
      body = { chat_id: uid, text: text, entities: ents || undefined, reply_markup: kb };
    }
    fetch("https://api.telegram.org/bot" + TOKEN + "/" + method, {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)
    }).then(function(r){ return r.json(); })
      .then(function(j){
        if(j && j.ok){
          ok++;
          const r = j.result;
          if(Array.isArray(r)) r.forEach(function(m){ sent.push({ u:uid, m:m.message_id }); });
          else if(r && r.message_id) sent.push({ u:uid, m:r.message_id });
        } else fail++;
      })
      .catch(function(){ fail++; })
      .then(function(){ setTimeout(step, 60); });
  }
  step();
}

function doRecall(){
  const db = load();
  const rec = db._bcast;
  if(!rec || !rec.items || !rec.items.length){
    send(ADMIN_ID, "O'chiradigan tarqatish topilmadi.");
    return;
  }
  const items = rec.items.slice();
  delete db._bcast; save(db);
  let ok = 0, fail = 0, i = 0;
  send(ADMIN_ID, "\uD83D\uDDD1 O'chirilmoqda\u2026 (" + items.length + " ta xabar)");
  function step(){
    if(i >= items.length){
      send(ADMIN_ID, "\u2705 O'chirildi: " + ok + "\nO'chmadi: " + fail +
                     (fail ? "\n(48 soatdan eski xabarlarni Telegram o'chirtirmaydi)" : ""));
      return;
    }
    const it = items[i++];
    fetch("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ chat_id: it.u, message_id: it.m })
    }).then(function(r){ return r.json(); })
      .then(function(j){ if(j && j.ok) ok++; else fail++; })
      .catch(function(){ fail++; })
      .then(function(){ setTimeout(step, 40); });
  }
  step();
}

function handleCb(cq){
  const from = String((cq.from && cq.from.id) || "");
  if(ADMIN_ID && from !== ADMIN_ID){
    tgCall("answerCallbackQuery", { callback_query_id: cq.id, text: "Ruxsat yo'q" });
    return;
  }
  const d = String(cq.data||"");
  if(d === "bc_ok" || d === "bc_no" || d === "bc_del"){
    tgCall("answerCallbackQuery", { callback_query_id: cq.id });
    if(d === "bc_no"){ bcastReset(); send(ADMIN_ID, "\u274C Bekor qilindi"); return; }
    if(d === "bc_del"){ doRecall(); return; }
    doBroadcast();
    return;
  }
  /* Qo'lda bajariladigan buyurtma — admin tasdiqlaydi yoki bekor qiladi */
  if(d.indexOf("od_ok:") === 0 || d.indexOf("od_no:") === 0){
    const p = d.split(":");
    if(p.length !== 3){ tgCall("answerCallbackQuery", { callback_query_id: cq.id }); return; }
    const dbo = load();
    const uo = urec(dbo, p[1]);
    const r = (uo.orders || []).find(function(x){ return x.id === p[2]; });
    if(!r || r.status !== "wait"){
      tgCall("answerCallbackQuery", { callback_query_id: cq.id, text: "Allaqachon ko'rib chiqilgan" });
      return;
    }
    let nt;
    if(p[0] === "od_ok"){
      r.status = "done"; r.doneAt = new Date().toISOString();
      nt = "\u2705 Bajarildi";
      send(p[1], "\u2705 "+r.package+" hisobingizga tushdi!");
    } else {
      if(typeof uo.balance !== "number") uo.balance = 0;
      uo.balance += r.price;
      r.status = "refund"; r.fail = "qo'lda bekor qilindi";
      nt = "\u274C Bekor \u2014 "+r.price+" qaytarildi";
      send(p[1], "\u274C Buyurtma bajarilmadi. "+r.price+" so'm balansga qaytarildi.\nJoriy balans: "+uo.balance+" so'm");
    }
    save(dbo);
    tgCall("answerCallbackQuery", { callback_query_id: cq.id, text: nt });
    const mo = cq.message;
    if(mo && mo.chat) tgCall("editMessageText", { chat_id: mo.chat.id, message_id: mo.message_id,
      text: (mo.text||"") + "\n\n" + nt });
    return;
  }
  const parts = d.split(":");
  if(parts.length !== 3 || (parts[0] !== "tp_ok" && parts[0] !== "tp_no")){
    tgCall("answerCallbackQuery", { callback_query_id: cq.id });
    return;
  }
  const uid = parts[1], tid = parts[2];
  const db = load();
  const u = urec(db, uid);
  const t = u.topups.find(function(x){ return x.id === tid; });
  if(!t || t.status !== "wait"){
    tgCall("answerCallbackQuery", { callback_query_id: cq.id, text: "Allaqachon ko'rib chiqilgan" });
    return;
  }
  let note;
  if(parts[0] === "tp_ok"){
    t.status = "done"; u.balance += t.amount;
    note = "✅ Tasdiqlandi (+"+t.amount+")";
    send(uid, "✅ Balansingiz to'ldirildi: +"+t.amount+" so'm\nJoriy balans: "+u.balance+" so'm");
  } else {
    t.status = "cancel";
    note = "❌ Rad etildi";
    send(uid, "❌ To'ldirish tasdiqlanmadi. Savol bo'lsa qo'llab-quvvatlashga yozing.");
  }
  save(db);
  tgCall("answerCallbackQuery", { callback_query_id: cq.id, text: note });
  const m = cq.message;
  if(m && m.chat) tgCall("editMessageText", { chat_id: m.chat.id, message_id: m.message_id,
    text: (m.text||"") + "\n\n" + note });
}

/* ---------- Bank SMS orqali avtomatik tasdiqlash ---------- */
/* iPhone "Komanda" ilovasi SMS matnini shu manzilga yuboradi.
   Kalit .env dagi SMS_KEY bilan mos kelmasa \u2014 rad etiladi. */

const SMS_KEY = String(process.env.SMS_KEY || "");
const smsSeen = [];   /* takroriy SMS'larni to'sish uchun */

/* Kutilayotgan to'lov summasi \u2014 payText bilan bir xil hisob.
   so'm karta uchun o'sha summaning o'zi, valyuta kartalar uchun tiyinli qiymat. */
function expectFor(t){
  const cur = CARD_CUR[String(t.method || "")] || "so'm";
  const r = RATES[cur] || 1;
  if(r === 1) return { cur: "so'm", v: t.amount };
  const step = Math.round((t.amount - t.base) / 100);
  const v = (Math.ceil(t.base / r * 100) / 100) + (step / 100);
  return { cur: cur, v: Math.round(v * 100) / 100 };
}

function smsHits(txt){
  const s = String(txt || "");
  const out = [];
  const push = function(cur, amt, ms){
    if(!isFinite(amt) || amt <= 0) return;
    const key = cur + ":" + amt.toFixed(2) + "@" + ms;
    if(out.some(function(x){ return x.key === key; })) return;
    out.push({ cur: cur, amount: amt, ms: ms, key: key });
  };
  /* Toshkent vaqti = UTC+5 */
  const tashMs = function(yy, mm, dd, hh, mi){
    return Date.UTC(2000 + Number(yy), Number(mm) - 1, Number(dd),
                    Number(hh) - 5, Number(mi));
  };

  /* 1) HUMO (so'm): "popolnenie 2100.00 UZS; BEEPUL P2P>UZ; 26-08-21 01:50; ..."
        Faqat "popolnenie". "operacija" \u2014 chiqim, tegilmaydi. */
  let m;
  const re1 = /popolnenie[^0-9]{0,12}([0-9][0-9\s.,]*)\s*(?:UZS|SUM|\u0421\u0423\u041C)[^;]*;[^;]*;\s*(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/gi;
  while((m = re1.exec(s))){
    push("so'm", Math.round(parseFloat(m[1].replace(/\s/g,"").replace(/,/g,"."))),
         tashMs(m[2], m[3], m[4], m[5], m[6]));
  }

  /* 2) HAMKORBANK Visa (USD):
        "...card Virtual VE *88: 26-08-20 03:13 credit HMB TIETO FO>Andijan +9.29 USD"
        Faqat "credit" va "+". "purchase ... -N.NN" \u2014 chiqim, tegilmaydi.
        "summa 0.00 USD, oplata u ..." \u2014 3D kod xabari, "credit" yo'q, o'tmaydi. */
  const re2 = /card[^:]{0,40}:\s*(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})\s+credit\b[^+]{0,80}\+\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*USD/gi;
  while((m = re2.exec(s))){
    push("usd", parseFloat(m[6].replace(/,/g,".")),
         tashMs(m[1], m[2], m[3], m[4], m[5]));
  }
  return out;
}

/* SBER (900): tiyin BOR ("перевод 22.25р"), lekin SANA YO'Q \u2014 faqat soat.
   Kirim: "СЧЁТ3003 23:06 Перевод 700р от Артём Н."
          "СЧЁТ3003 21:44 Перевод по СБП из Т-Банк +350р от ВЛАДИСЛАВ Д."
   Chiqim: "СЧЁТ3003 22:58 перевод 1300р" \u2014 oxirida "от Ism" YO'Q, o'tmaydi.
   "Покупка" va "зачисление ... ATM" ham o'tmaydi.
   TIYINLI summa AVTO tasdiqlanadi; butun summa faqat xabar qilinadi, chunki
   unda noyob belgi ko'rinmaydi va boshqa mijozniki bilan adashishi mumkin. */
function sberHits(txt){
  const s = String(txt || "");
  const out = [];
  const re = /(\d{1,2}):(\d{2})\s+\u041F\u0435\u0440\u0435\u0432\u043E\u0434[^0-9\n]{0,40}([0-9][0-9\s]{0,9}(?:[.,][0-9]{1,2})?)\s*\u0440\s+\u043E\u0442\s+([^\n.]{1,40})/gi;
  let m;
  while((m = re.exec(s))){
    const raw = m[3].replace(/\s/g,"").replace(/,/g,".");
    const amt = parseFloat(raw);
    if(!isFinite(amt) || amt <= 0) continue;
    out.push({ amount: Math.round(amt*100)/100,
               cents: raw.indexOf(".") > -1,
               hh: Number(m[1]), mi: Number(m[2]),
               from: m[4].trim() });
  }
  return out;
}

/* Sana yo'q, shuning uchun soat bo'yicha tekshiramiz.
   Sber Moskva vaqtida yozadi, telefon Toshkentda bo'lishi mumkin \u2014
   ikkala hisobdan biri to'g'ri kelsa yetarli. */
function sberFresh(h){
  const mins = h.hh * 60 + h.mi;
  const now  = Date.now();
  for(let i = 0; i < 2; i++){
    const off = i === 0 ? 3 : 5;
    const d = new Date(now + off * 3600 * 1000);
    const nowMin = d.getUTCHours() * 60 + d.getUTCMinutes();
    let diff = Math.abs(nowMin - mins);
    if(diff > 720) diff = 1440 - diff;     /* yarim tundan o'tishi */
    if(diff <= 60) return true;
  }
  return false;
}

app.post("/sms", (req,res)=>{
  try{
    const b = req.body || {};
    if(!SMS_KEY || String(b.key||"") !== SMS_KEY) return res.json({ ok:false, error:"auth" });

    const txt = String(b.text || "").trim();
    if(!txt) return res.json({ ok:false, error:"empty" });

    /* bir xil SMS ikki marta kelsa \u2014 e'tiborsiz qoldiramiz */
    if(smsSeen.indexOf(txt) > -1) return res.json({ ok:true, dup:true });
    smsSeen.push(txt); if(smsSeen.length > 200) smsSeen.shift();

    const all   = smsHits(txt);
    const fresh = all.filter(function(h){ return Math.abs(Date.now() - h.ms) < 30*60*1000; });

    /* Sber: sanasi yo'q, shuning uchun soat bo'yicha filtrlanadi.
       Kirim ("... от Ism") bo'lsa umumiy oqimga qo'shiladi. */
    const sb = sberHits(txt);
    sb.forEach(function(h){
      if(sberFresh(h)) fresh.push({ cur:"rubl", amount:h.amount, from:h.from, ms:Date.now() });
    });

    if(all.length === 0 && sb.length === 0){
      return res.json({ ok:true, parsed:false });
    }
    if(fresh.length === 0){
      return res.json({ ok:true, stale:true });
    }
    if(fresh.length > 1){
      if(ADMIN_ID) send(ADMIN_ID, "\u26A0\uFE0F Bitta SMS'da " + fresh.length +
        " ta yangi to'lov bor \u2014 QO'LDA ko'ring.\n\n" + txt);
      return res.json({ ok:true, many:true });
    }
    const cur    = fresh[0].cur;
    const amount = fresh[0].amount;
    const label  = cur === "so'm" ? (amount + " so'm") : (amount.toFixed(2) + " " + cur);

    const db = load();
    expireOld(db);
    const lim = Date.now() - 60*60*1000;      /* 1 soatdan eskisi hisobga olinmaydi */
    const hits = [];
    Object.keys(db).forEach(function(uid){
      if(!/^\d+$/.test(uid)) return;
      (db[uid].topups || []).forEach(function(t){
        if(t.status !== "wait" || new Date(t.at).getTime() <= lim) return;
        if(t.memo) return;              /* USDT to'lovi \u2014 bank SMS'i unga tegmasin */
        const e = expectFor(t);
        if(e.cur !== cur) return;
        if(Math.abs(e.v - amount) < 0.005) hits.push({ uid: uid, t: t });
      });
    });

    if(hits.length === 0){
      if(ADMIN_ID) send(ADMIN_ID, "\u26A0\uFE0F " + label + " keldi" +
        (fresh[0].from ? " (" + fresh[0].from + ")" : "") +
        ", lekin mos to'ldirish topilmadi.\n\n" + txt);
      return res.json({ ok:true, matched:0 });
    }
    if(hits.length > 1){
      if(ADMIN_ID) send(ADMIN_ID, "\u26A0\uFE0F " + label + " ga " + hits.length +
        " ta to'ldirish mos keldi \u2014 QO'LDA tasdiqlang.\n\n" + txt);
      return res.json({ ok:true, matched:hits.length });
    }

    const h = hits[0];
    const u = urec(db, h.uid);
    const t = u.topups.find(function(x){ return x.id === h.t.id; });
    if(!t || t.status !== "wait") return res.json({ ok:true, already:true });

    t.status = "done";
    t.auto = true;
    u.balance += t.amount;
    save(db);

    send(h.uid, "\u2705 Balansingiz to'ldirildi: +" + t.amount + " so'm\nJoriy balans: " + u.balance + " so'm");
    if(ADMIN_ID) send(ADMIN_ID, "\uD83E\uDD16 AVTO TASDIQ " + t.id +
      "\nKelgan: " + label + " (" + (t.method || "-") + ")" +
      "\nBalansga: " + t.amount + " so'm" +
      "\nKimga: " + (t.who || h.uid) +
      "\nYangi balans: " + u.balance);

    res.json({ ok:true, matched:1, id:t.id });
  }catch(e){ console.log("SMS XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

app.post("/webhook", (req,res)=>{
  res.sendStatus(200);
  const hdr = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if(SECRET && hdr !== SECRET) return;
  try{
    const cq = req.body && req.body.callback_query;
    if(cq){ handleCb(cq); return; }

    /* Stars to'lovi: 10 soniya ichida javob berish SHART, aks holda bekor bo'ladi */
    const pcq = req.body && req.body.pre_checkout_query;
    if(pcq){
      const okPay = String(pcq.invoice_payload||"").indexOf("star:") === 0;
      tgCall("answerPreCheckoutQuery", { pre_checkout_query_id: pcq.id, ok: okPay,
        error_message: okPay ? undefined : "To'lovni tekshirib bo'lmadi, qaytadan urinib ko'ring" });
      return;
    }

    const msg = req.body && req.body.message;
    if(!msg) return;
    const fromId = String((msg.from && msg.from.id) || "");
    if(!fromId) return;

    /* Username va ismni yozib boramiz \u2014 /toldirish shu orqali odamni topadi.
       Telegram bot API'sida username -> id qidiruvi YO'Q, shuning uchun
       faqat o'zimiz ko'rgan odamlarni topa olamiz. */
    try{
      const un = String((msg.from && msg.from.username) || "").toLowerCase();
      const nm = String((msg.from && msg.from.first_name) || "").trim();
      if(un || nm){
        const dbU = load();
        const uu = urec(dbU, fromId);
        if(uu.un !== un || uu.nm !== nm){ uu.un = un; uu.nm = nm; save(dbU); }
      }
    }catch(e){}

    if(msg.successful_payment){
      starPaid(fromId, msg.successful_payment);
      return;
    }

    if(msg.contact && msg.contact.phone_number){
      const ownerId = String(msg.contact.user_id || "");
      if(ownerId !== fromId){
        send(fromId, "⚠️ Faqat o'zingizning raqamingizni ulashishingiz mumkin.", { remove_keyboard: true });
        return;
      }
      const db = load();
      const u = urec(db, fromId);
      u.phone = msg.contact.phone_number;
      u.at = new Date().toISOString();
      save(db);
      send(fromId, "✅ Rahmat! Telefon raqamingiz saqlandi.", { remove_keyboard: true });
      return;
    }

    const text = String(msg.text || "");
    if(ADMIN_ID && fromId === ADMIN_ID && msg.reply_to_message){
      if(adminReply(msg)) return;
    }
    if(ADMIN_ID && fromId === ADMIN_ID){
      const arm = { "/xabar":"btn", "/bonus":"bonus", "/oyin":"oyin", "/yangi":"yangi", "/albom":"plain" };
      let hit = null;
      Object.keys(arm).forEach(function(c){ if(text.indexOf(c) === 0) hit = c; });
      if(hit){
        bcastReset();
        bcast.armed = true;
        bcast.mode = arm[hit];
        const tip = hit === "/albom"
          ? "Bir nechta rasmni birga tanlab yuboring (izoh bilan). Tugma bo'lmaydi."
          : hit === "/bonus"
            ? "Bitta rasm yoki matn yuboring. Ostida \uD83C\uDF81 Bonus olish tugmasi bo'ladi."
          : hit === "/oyin"
            ? "Bitta rasm yoki matn yuboring. Ostida \uD83C\uDFAE Yangi o'yinlarni ko'rish tugmasi bo'ladi."
          : hit === "/yangi"
            ? "Bitta rasm yoki matn yuboring. Ostida \u2728 Yangilikni sinab ko'rish tugmasi bo'ladi."
          : "Bitta rasm yoki matn yuboring. Ostida \uD83D\uDE80 Xaridni boshlash tugmasi bo'ladi.";
        send(fromId, "\uD83D\uDCE2 Keyingi xabaringiz BARCHA foydalanuvchilarga yuboriladi.\n\n" +
                     tip + "\nBekor qilish uchun /bekor");
        return;
      }
      if(text.indexOf("/bekor") === 0){
        bcastReset();
        send(fromId, "\u274C Tarqatish bekor qilindi");
        return;
      }
      if(text.indexOf("/ochir") === 0){
        const db0 = load();
        const n = (db0._bcast && db0._bcast.items) ? db0._bcast.items.length : 0;
        if(!n){ send(fromId, "O'chiradigan tarqatish topilmadi."); return; }
        tgCall("sendMessage", { chat_id: fromId,
          text: "\uD83D\uDDD1 Oxirgi tarqatish (" + n + " ta xabar) HAMMADAN o'chirilsinmi?",
          reply_markup: { inline_keyboard: [[
            { text: "\u2705 Ha, o'chirilsin", callback_data: "bc_del" },
            { text: "\u274C Yo'q", callback_data: "bc_no" }
          ]]}});
        return;
      }
      if(bcast.armed){
        if(msg.photo && msg.photo.length){
          const fid = msg.photo[msg.photo.length-1].file_id;
          if(msg.media_group_id){
            /* albom \u2014 rasmlar alohida keladi, 2 soniya kutib yig'amiz */
            if(bcast.grp !== msg.media_group_id){ bcast.grp = msg.media_group_id; bcast.album = []; }
            if(bcast.album.length < 10) bcast.album.push(fid);
            if(msg.caption){ bcast.text = String(msg.caption); bcast.ents = msg.caption_entities || null; }
            bcast.kind = "album";
            if(bcast.timer) clearTimeout(bcast.timer);
            bcast.timer = setTimeout(function(){ bcast.armed = false; bcastAsk(); }, 2000);
            return;
          }
          bcast.kind = "photo";
          bcast.photo = fid;
          bcast.text = String(msg.caption || "");
          bcast.ents = msg.caption_entities || null;
        } else if(text){
          bcast.kind = "text";
          bcast.text = text;
          bcast.ents = msg.entities || null;
        } else {
          send(fromId, "Faqat rasm yoki matn yuboring. Bekor qilish: /bekor");
          return;
        }
        bcast.armed = false;
        bcastAsk();
        return;
      }
    }
    /* /zaxira \u2014 ro'yxat yoki yangi zaxira olish */
    if(text.indexOf("/zaxira") === 0){
      if(ADMIN_ID && fromId !== ADMIN_ID) return;
      if(/yangi|toliq|to'liq/i.test(text)){
        const n = dbBackup();
        bkToTelegram("\uD83D\uDCBE Qo'lda olingan to'liq zaxira");
        send(fromId, n ? ("\u2705 Zaxira olindi: " + n + "\nTo'liq arxiv Telegram'ga yuborilyapti\u2026")
                       : "\u274C Zaxira olinmadi (baza bo'shmi?)");
        return;
      }
      const l = bkList();
      if(!l.length){ send(fromId, "Hali zaxira yo'q. Olish: /zaxira yangi"); return; }
      let cur = 0; try{ cur = fs.statSync(DB).size; }catch(e){}
      let arx = [];
      try{ arx = fs.readdirSync(BKDIR).filter(f => /^toliq-.*\.tar\.gz$/.test(f)).sort().reverse(); }catch(e){}
      const rows = l.slice(0,12).map(function(f){
        let sz = 0; try{ sz = fs.statSync(BKDIR+"/"+f).size; }catch(e){}
        return f + "  \u2014 " + sz + " bayt";
      });
      send(fromId, "\uD83D\uDCBE Zaxiralar\nHozirgi baza: " + cur + " bayt" +
                   "\nBaza nusxalari: " + l.length + " ta" +
                   "\nTo'liq arxivlar: " + arx.length + " ta\n\n" +
                   rows.join("\n") +
                   "\n\nTiklash: /tiklash " + l[0] +
                   "\nYangi olish: /zaxira yangi");
      return;
    }
    /* /tiklash <nom> \u2014 zaxiradan qaytarish */
    if(text.indexOf("/tiklash") === 0){
      if(ADMIN_ID && fromId !== ADMIN_ID) return;
      const nm2 = text.replace("/tiklash","").trim();
      if(!nm2){ send(fromId, "Ishlatilishi: /tiklash <fayl nomi>\nRo'yxat: /zaxira"); return; }
      if(!/^data-[0-9-]+\.json$/.test(nm2)){ send(fromId, "\u274C Nom noto'g'ri. Ro'yxat: /zaxira"); return; }
      const p = BKDIR + "/" + nm2;
      if(!fs.existsSync(p)){ send(fromId, "\u274C Bunday zaxira yo'q. Ro'yxat: /zaxira"); return; }
      try{
        const txt = fs.readFileSync(p, "utf8");
        const parsed = JSON.parse(txt);                 /* buzilgan zaxirani tiklamaymiz */
        const users = Object.keys(parsed).filter(x => /^\d+$/.test(x)).length;
        try{ fs.copyFileSync(DB, BKDIR + "/oldindan-" + bkName()); }catch(e){}
        fs.writeFileSync(DB + ".tmp", txt);
        fs.renameSync(DB + ".tmp", DB);
        dbOk = true;
        send(fromId, "\u2705 Tiklandi: " + nm2 +
                     "\nFoydalanuvchilar: " + users +
                     "\nHajmi: " + txt.length + " bayt" +
                     "\n\nEski holat ham saqlandi (oldindan-...)");
      }catch(e){ send(fromId, "\u274C Tiklash xatosi: " + e.message); }
      return;
    }
    /* /toldirish @username  \u2014 ikki qadamli balans to'ldirish */
    if(text.indexOf("/toldirish") === 0 || text.indexOf("/to'ldirish") === 0){
      if(ADMIN_ID && fromId !== ADMIN_ID) return;
      const q = text.replace(/^\/to'?ldirish/, "").trim().replace(/^@/, "").toLowerCase();
      if(!q){
        send(fromId, "Ishlatilishi:\n/toldirish @username\nyoki\n/toldirish 123456789");
        return;
      }
      const db = load();
      let hit = "";
      Object.keys(db).forEach(function(k){
        if(!/^\d+$/.test(k)) return;
        if(k === q) hit = k;
        else if(db[k].un && db[k].un === q) hit = k;
      });
      if(!hit){
        send(fromId, "\u274C \"" + q + "\" topilmadi.\n\nBot bu odamni faqat u botga kirgandan keyin taniydi. " +
                     "Uning id raqamini buyurtma xabaridan (\uD83D\uDC65 id: ...) olib, shu raqam bilan urinib ko'ring.");
        return;
      }
      const u = urec(db, hit);
      pendTop[fromId] = hit;
      save(db);
      send(fromId, "\uD83D\uDC64 " + (u.nm || hit) + (u.un ? " (@" + u.un + ")" : "") +
                   "\nid: " + hit +
                   "\nJoriy balans: " + u.balance + " so'm" +
                   "\n\nQancha so'm QO'SHMOQCHISIZ? Raqam yozing." +
                   "\n(Balansni aniq o'rnatish uchun: /balans " + hit + " <summa>)" +
                   "\nBekor qilish: /bekor");
      return;
    }
    /* /toldirish dan keyingi raqam */
    if(pendTop[fromId] && /^-?\d+$/.test(text.trim())){
      const target = pendTop[fromId];
      delete pendTop[fromId];
      const db = load();
      const u = urec(db, target);
      const eski = u.balance;
      u.balance += Number(text.trim());
      save(db);
      send(fromId, "\u2705 " + (u.nm || target) + "\n" + eski + " \u2192 " + u.balance + " so'm");
      send(target, "\u2705 Balansingiz to'ldirildi!\nJoriy balans: " + u.balance + " so'm");
      return;
    }
    /* /balans <uid> <summa>  \u2014 balansni QO'LDA o'rnatish (faqat admin).
       Baza yo'qolganda tiklash uchun. */
    if(text.indexOf("/balans") === 0){
      if(ADMIN_ID && fromId !== ADMIN_ID) return;
      const a = text.trim().split(/\s+/);
      if(a.length < 3 || !/^\d+$/.test(a[1]) || !/^-?\d+$/.test(a[2])){
        send(fromId, "Ishlatilishi:\n/balans <foydalanuvchi_id> <summa>\n\nMasalan:\n/balans 123456789 21000");
        return;
      }
      const db = load();
      const u = urec(db, a[1]);
      const eski = (typeof u.balance === "number") ? u.balance : 0;
      u.balance = Number(a[2]);
      save(db);
      send(fromId, "\u2705 "+a[1]+"\nEski: "+eski+" so'm\nYangi: "+u.balance+" so'm");
      return;
    }
    if(text.indexOf("/kutish") === 0){
      if(ADMIN_ID && fromId !== ADMIN_ID) return;
      const db = load(); expireOld(db); save(db);
      const rows = [];
      Object.keys(db).forEach(function(k){
        const t = db[k] && db[k].topups;
        if(Array.isArray(t)) t.forEach(function(x){
          if(x.status === "wait") rows.push(x.amount+" so'm — "+(x.who||k)+" — "+x.id);
        });
      });
      send(fromId, rows.length ? ("⏳ Kutilmoqda:\n\n"+rows.join("\n")) : "✅ Kutilayotgan to'ldirish yo'q");
      return;
    }
    if(text.indexOf("/help") === 0 || text.indexOf("/yordam") === 0){
      tgCall("sendMessage", { chat_id: fromId, parse_mode: "HTML",
        text: "\uD83E\uDD16 <b>MinatoUz \u2014 yordam</b>\n\n" +
              "\uD83D\uDED2 <b>Donat xarid qilish</b> \u2014 Mini App orqali buyurtma bering.\n" +
              "\uD83D\uDD0E <b>Nickname va ID</b> \u2014 buyurtma berishdan oldin ma'lumotlaringiz tekshiriladi.\n" +
              "\uD83C\uDF0D <b>Serverlar</b> \u2014 Global, RU, Indonesia, Malaysia, Philippines, Singapore, Turkey, USA, Brazil.\n" +
              "\uD83D\uDCB3 <b>Balansni to'ldirish</b> \u2014 ilovadagi \"Hisobni to'ldirish\" bo'limi.\n" +
              "\uD83D\uDCE6 <b>Buyurtma holati</b> \u2014 ilovadagi \"Tarix\" bo'limida ko'rinadi va o'zi yangilanadi.\n" +
              "\u23F1 <b>Yetkazish</b> \u2014 odatda 1-2 daqiqada avtomatik tushadi.\n\n" +
              "\uD83D\uDCAC Muammo bo'lsa \u2014 /support",
        reply_markup: { inline_keyboard: [
          [{ text: "\uD83D\uDE80 Xaridga o'tish", web_app: { url: APP_URL } }],
          [{ text: "\uD83D\uDCAC Qo'llab-quvvatlash", url: SUPPORT }]
        ]}});
      return;
    }
    if(text.indexOf("/support") === 0){
      tgCall("sendMessage", { chat_id: fromId, parse_mode: "HTML",
        text: "\uD83D\uDCAC <b>Qo'llab-quvvatlash</b>\n\n" +
              "Savol yoki muammo bo'lsa, to'g'ridan-to'g'ri yozing:\n" +
              "\uD83D\uDC64 " + SUPPORT.replace("https://t.me/", "@") + "\n\n" +
              "Tezroq yordam berishimiz uchun quyidagilarni yozib yuboring:\n" +
              "\u2022 Buyurtma raqami (masalan MT12345678)\n" +
              "\u2022 O'yin va paket nomi\n" +
              "\u2022 O'yinchi ID va server raqami\n" +
              "\u2022 Muammoni qisqacha tushuntiring\n\n" +
              "Buyurtma bajarilmasa, pul avtomatik balansga qaytadi \u2014 bu holatda kutib turing.",
        reply_markup: { inline_keyboard: [
          [{ text: "\uD83D\uDC64 Adminga yozish", url: SUPPORT }],
          [{ text: "\u26A1\uFE0F Yangiliklar", url: CHANNEL }]
        ]}});
      return;
    }
    if(text.indexOf("/start") === 0){
      const dbg = load();
      const ug = urec(dbg, fromId);
      const first = !ug.greeted;
      if(first){ ug.greeted = true; ug.joined = new Date().toISOString(); save(dbg); }

      const openKb = { inline_keyboard: [
        [{ text: "\uD83D\uDE80 Xaridga o'tish", web_app: { url: APP_URL } }]
      ]};

      /* Eski foydalanuvchi \u2014 uzun salomlashuv qayta chiqmaydi */
      if(!first){
        tgCall("sendMessage", { chat_id: fromId,
          text: "\uD83D\uDC4B Xaridni davom ettirish uchun pastdagi tugmani bosing.",
          reply_markup: openKb });
        return;
      }

      const nm = String((msg.from && msg.from.first_name) || "").trim();
      const cap =
        "\uD83D\uDC4B Xush kelibsiz" + (nm ? ", <b>"+esc(nm)+"</b>" : "") + "!\n\n" +
        "Bu <b>MinatoUz</b> \u2014 o'yin donatlarini kutmasdan olishning eng tez yo'li.\n\n" +
        "\u26A1\uFE0F PUBG Mobile, Mobile Legends, Free Fire\n" +
        "\u26A1\uFE0F Telegram Stars va Telegram Premium\n" +
        "\u26A1\uFE0F To'liq avtomatik \u2014 buyurtma bir daqiqada bajariladi\n" +
        "\u26A1\uFE0F Qulay to'lov: Humo va Sberbank\n\n" +
        "\uD83D\uDC47 Pastdagi tugmani bosing va hoziroq boshlang";
      const kb = { inline_keyboard: [
        [{ text: "\uD83D\uDE80 Xaridga o'tish", web_app: { url: APP_URL } }],
        [{ text: "\u26A1\uFE0F Yangiliklar", url: CHANNEL },
         { text: "\uD83D\uDC68\u200D\uD83D\uDCBB Qo'llab-quvvatlash", url: SUPPORT }]
      ]};
      if(BANNER){
        tgCall("sendPhoto", { chat_id: fromId, photo: BANNER, caption: cap,
                              parse_mode: "HTML", reply_markup: kb });
      } else {
        tgCall("sendMessage", { chat_id: fromId, text: cap,
                                parse_mode: "HTML", reply_markup: kb,
                                link_preview_options: { is_disabled: true } });
      }
      return;
    }
  }catch(e){ console.log("WH XATO:", e.message); }
});

function send(chatId, text, markup){
  if(!TOKEN || !chatId) return;
  const body = { chat_id: chatId, text: text };
  if(markup) body.reply_markup = markup;
  fetch("https://api.telegram.org/bot"+TOKEN+"/sendMessage", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body)
  }).catch(function(e){ console.log("SEND xato:", e.message); });
}

app.listen(3001,"0.0.0.0",()=>console.log("API 3001-portda ishlayapti"));
