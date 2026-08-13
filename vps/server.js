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
  if(SECRET && req.get("X-Telegram-Bot-Api-Secret-Token") !== SECRET) return;
  try{
    const msg = req.body && req.body.message;
    if(!msg || !msg.contact || !msg.contact.phone_number) return;
    const fromId = String((msg.from && msg.from.id) || "");
    const ownerId = String(msg.contact.user_id || "");
    if(!fromId || ownerId !== fromId){
      send(fromId, "⚠️ Faqat o'zingizning raqamingizni ulashishingiz mumkin.");
      return;
    }
    const db = load();
    db[fromId] = { phone: msg.contact.phone_number, at: new Date().toISOString() };
    save(db);
    send(fromId, "✅ Rahmat! Telefon raqamingiz saqlandi.");
  }catch(e){ console.log(e); }
});

function send(chatId, text){
  if(!TOKEN || !chatId) return;
  fetch("https://api.telegram.org/bot"+TOKEN+"/sendMessage", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ chat_id: chatId, text: text })
  })
  .then(function(r){ return r.text(); })
  .then(function(t){ console.log("SEND javob:", t); })
  .catch(function(e){ console.log("SEND xato:", e.message); });
}

app.listen(3001,"0.0.0.0",()=>console.log("API 3001-portda ishlayapti"));
