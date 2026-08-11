const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const TOKEN = process.env.BOT_TOKEN;
  const ADMIN = process.env.ADMIN_CHAT_ID;
  if (!TOKEN || !ADMIN) return res.status(500).json({ ok: false, error: 'config' });

  try {
    const body = req.body || {};
    const order = body.order;
    if (!order) return res.status(400).json({ ok: false, error: 'no_order' });

    const user = verify(body.initData, TOKEN);
    if (!user) return res.status(401).json({ ok: false, error: 'auth' });

    const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN, text: build(order, user), parse_mode: 'HTML' })
    });
    const data = await r.json();
    if (!data.ok) return res.status(502).json({ ok: false, error: data.description });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};

function verify(initData, token) {
  if (!initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const check = [...p.entries()].map(function (e) { return e[0] + '=' + e[1]; }).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (calc !== hash) return null;
  const authDate = Number(p.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;
  try { return JSON.parse(p.get('user') || 'null'); } catch (e) { return null; }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmt(n) {
  return Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
}

function build(o, u) {
  const L = [];
  L.push('🆕 <b>Yangi buyurtma</b>');
  L.push('');
  L.push('🎮 ' + esc(o.game) + ' — ' + esc(o.package));
  L.push('💰 ' + fmt(o.price) + " so'm");
  if (o.region) L.push('🌍 ' + esc(o.region));
  L.push('');
  if (o.details) {
    Object.keys(o.details).forEach(function (k) {
      L.push('🔑 ' + esc(k) + ': <code>' + esc(o.details[k]) + '</code>');
    });
  }
  L.push('');
  L.push('👤 ' + esc(u.first_name || '') + (u.username ? ' (@' + esc(u.username) + ')' : ''));
  L.push('🆔 <code>' + esc(u.id) + '</code>');
  L.push('📄 №' + esc(o.id));
  return L.join('\n');
}
