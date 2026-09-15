/* tglogin.js — ikkinchi Telegram hisobiga BIR MARTA kirish.
   Ishga tushirish:  cd /root/donate-app && node tglogin.js
   Natija: .env ga TG_SESSION yoziladi. Keyin bu fayl kerak emas.

   Kalitlar .env dan o'qiladi:
     TG_API_ID=...
     TG_API_HASH=...
*/
const fs = require("fs");
const path = "/root/donate-app/.env";
const env = fs.readFileSync(path, "utf8");
const pick = k => ((env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1] || "").trim();

const apiId   = Number(pick("TG_API_ID"));
const apiHash = pick("TG_API_HASH");

if (!apiId || !apiHash) {
  console.log("XATO: .env da TG_API_ID yoki TG_API_HASH yo'q.");
  console.log("Avval ularni qo'shing, keyin qaytadan ishga tushiring.");
  process.exit(1);
}
if (pick("TG_SESSION")) {
  console.log("Diqqat: .env da TG_SESSION allaqachon bor.");
  console.log("Qayta kirish kerak bo'lsa avval o'sha qatorni o'chiring.");
  process.exit(1);
}

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, a => r(a.trim())));

(async () => {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash,
    { connectionRetries: 3 });

  console.log("\nTelegram'ga ulanmoqda...\n");
  await client.start({
    phoneNumber:  async () => await ask("Telefon raqami (+998... ko'rinishida): "),
    phoneCode:    async () => await ask("Telegram'dan kelgan kod: "),
    password:     async () => await ask("Ikki bosqichli parol (bo'lmasa Enter): "),
    onError:      (e) => console.log("Xato:", e && e.message ? e.message : e)
  });

  const me = await client.getMe();
  const session = client.session.save();

  fs.appendFileSync(path, "\nTG_SESSION=" + session + "\n");

  console.log("\n=== TAYYOR ===");
  console.log("Kirildi: " + [me.firstName, me.lastName].filter(Boolean).join(" ") +
              (me.username ? " (@" + me.username + ")" : ""));
  console.log("Seans .env ga yozildi (TG_SESSION).");
  console.log("Endi bu faylni o'chirib tashlashingiz mumkin: rm tglogin.js");
  await client.disconnect();
  rl.close();
  process.exit(0);
})().catch(e => {
  console.log("XATO:", e && e.message ? e.message : e);
  process.exit(1);
});
