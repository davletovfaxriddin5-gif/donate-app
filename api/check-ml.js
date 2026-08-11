export default async function handler(req, res) {
  try {
    const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json());
    return res.status(200).json(ip);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
