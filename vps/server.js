try{ require("dns").setDefaultResultOrder("ipv4first"); }catch(e){}
const express = require("express");
const fs = require("fs");
const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN || "";
const SECRET = process.env.WEBHOOK_SECRET || "";
const DB = "/root/donate-app/data.json";

function load(){ try{ return JSON.parse(fs.readFileSync(DB,"utf8")); }catch(e){ return {}; } }
function save(d){ try{ fs.writeFileSync(DB, JSON.stringify(d)); }catch(e){} }

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

    const cat = FZR_CATS[game];
    if(!cat) return res.json({ ok:false, reason:"unsupported" });
    if(!/^\d{4,15}$/.test(playerId)) return res.json({ ok:false, reason:"bad_id" });
    if(game === "mlbb" && !/^\d{1,6}$/.test(zoneId)) return res.json({ ok:false, reason:"bad_zone" });
    if(!FZR_KEY){ console.log("VALIDATE: FZR_API_KEY yo'q"); return res.json({ ok:false, reason:"error" }); }

    const key = game+":"+playerId+":"+zoneId;
    const hit = vCache.get(key);
    if(hit && Date.now() - hit.at < 300000) return res.json(hit.data);
    if(!vAllow()) return res.json({ ok:false, reason:"busy" });

    const fields = { player_id: playerId };
    if(game === "mlbb") fields.zone_id = zoneId;

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

app.post("/webhook", (req,res)=>{
  res.sendStatus(200);
  const hdr = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
  console.log("WH1 secret bor?", !!SECRET, "mos?", (!SECRET || hdr === SECRET));
  if(SECRET && hdr !== SECRET) return;
  try{
    const msg = req.body && req.body.message;
    if(!msg){ console.log("WH2 message yo'q"); return; }
    const fromId = String((msg.from && msg.from.id) || "");
    console.log("WH3 from:", fromId, "text:", JSON.stringify(msg.text || ""), "contact:", !!msg.contact);
    if(!fromId) return;

    if(msg.contact && msg.contact.phone_number){
      const ownerId = String(msg.contact.user_id || "");
      if(ownerId !== fromId){
        send(fromId, "⚠️ Faqat o'zingizning raqamingizni ulashishingiz mumkin.", { remove_keyboard: true });
        return;
      }
      const db = load();
      db[fromId] = { phone: msg.contact.phone_number, at: new Date().toISOString() };
      save(db);
      send(fromId, "✅ Rahmat! Telefon raqamingiz saqlandi.", { remove_keyboard: true });
      return;
    }

    const text = String(msg.text || "");
    if(text.indexOf("/start") === 0){
      console.log("WH4 start topildi, klaviatura yuborilmoqda");
      send(fromId, "📱 Telefon raqamingizni ulashish uchun pastdagi tugmani bosing.", {
        keyboard: [[{ text: "📱 Raqamni ulashish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      });
    } else {
      console.log("WH5 start emas");
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
  })
  .then(function(r){ return r.text(); })
  .then(function(t){ console.log("SEND javob:", t); })
  .catch(function(e){ console.log("SEND xato:", e.message); });
}

app.listen(3001,"0.0.0.0",()=>console.log("API 3001-portda ishlayapti"));
