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
