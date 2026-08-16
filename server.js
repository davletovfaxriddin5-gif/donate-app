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

/* ---------- Balans, buyurtma va to'ldirish ---------- */
const crypto = require("crypto");
const ADMIN_ID = String(process.env.ADMIN_ID || "");

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

app.get("/orders", (req,res)=>{
  const db = load();
  const rec = db[String(req.query.id||"")];
  res.json({ ok:true, orders:(rec && rec.orders) || [], topups:(rec && rec.topups) || [] });
});

app.post("/order", (req,res)=>{
  try{
    const b = req.body || {};
    const who = checkInit(b.initData);
    if(!who) return res.json({ ok:false, error:"auth" });
    const uid = who.id;
    const o = b.order || {};
    const price = Math.round(Number(o.price) || 0);
    if(!(price > 0)) return res.json({ ok:false, error:"price" });

    const db = load();
    const u = urec(db, uid);
    if(u.balance < price) return res.json({ ok:false, error:"balance", balance:u.balance, need:price });

    u.balance -= price;
    const rec = {
      id: String(o.id || ("MT"+Date.now().toString().slice(-8))),
      game: String(o.game||""), gameId: String(o.gameId||""),
      package: String(o.package||""), price: price,
      details: o.details || {}, region: o.region || null,
      nick: String(o.nick||""), accRegion: String(o.accRegion||""),
      status: "wait", at: new Date().toISOString()
    };
    u.orders.unshift(rec); u.orders = u.orders.slice(0,100);
    save(db);

    const det = Object.keys(rec.details).map(function(k){ return k+": "+rec.details[k]; }).join("\n");
    if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "🧾 BUYURTMA "+rec.id+"\n"+rec.game+" — "+rec.package+"\n"+
            (rec.nick ? ("👤 "+rec.nick+(rec.accRegion?" ("+rec.accRegion+")":"")+"\n") : "")+
            det+"\n💰 "+rec.price+" so'm\n👥 id: "+uid+"\nQoldiq: "+u.balance });

    send(uid, "✅ Buyurtma qabul qilindi: "+rec.package+"\nQoldiq balans: "+u.balance+" so'm");
    res.json({ ok:true, balance:u.balance, order:rec });
  }catch(e){ console.log("ORDER XATO:", e.message); res.json({ ok:false, error:"server" }); }
});

function who2(w){ return w.name + (w.username ? " (@"+w.username+")" : ""); }

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
    if(Array.isArray(t)) t.forEach(function(x){ if(x.status === "wait") set.add(x.amount); });
  });
  return set;
}

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

    const used = usedAmounts(db);
    let pay = 0;
    for(let n = 1; n <= 999; n++){ if(!used.has(base + n)){ pay = base + n; break; } }
    if(!pay) return res.json({ ok:false, error:"busy" });

    const id = "TP"+Date.now().toString().slice(-8);
    u.topups.unshift({ id:id, amount:pay, base:base, method:String(b.method||""),
                       status:"wait", at:new Date().toISOString(),
                       who:who2(who) });
    u.topups = u.topups.slice(0,60);
    save(db);

    if(ADMIN_ID) tgCall("sendMessage", { chat_id: ADMIN_ID,
      text: "💳 TO'LDIRISH "+id+
            "\nAYNAN: "+pay+" so'm"+
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

function handleCb(cq){
  const from = String((cq.from && cq.from.id) || "");
  if(ADMIN_ID && from !== ADMIN_ID){
    tgCall("answerCallbackQuery", { callback_query_id: cq.id, text: "Ruxsat yo'q" });
    return;
  }
  const parts = String(cq.data||"").split(":");
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

app.post("/webhook", (req,res)=>{
  res.sendStatus(200);
  const hdr = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
  console.log("WH1 secret bor?", !!SECRET, "mos?", (!SECRET || hdr === SECRET));
  if(SECRET && hdr !== SECRET) return;
  try{
    const cq = req.body && req.body.callback_query;
    if(cq){ handleCb(cq); return; }
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
