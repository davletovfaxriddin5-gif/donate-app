export default async function handler(req, res) {
  const { id, server } = req.query;

  if (!id || !server) {
    return res.status(400).json({
      success: false,
      message: 'ID yoki Server kiritilmagan'
    });
  }

  try {
    const response = await fetch(
      `https://aluu.in/api/check/mlbb-check?user_id=${id}&server_id=${server}`,
      {
        headers: {
          'x-api-key': process.env.ALUU_API_KEY
        }
      }
    );

    const data = await response.json();

    if (data.success) {
      return res.status(200).json({
        success: true,
        username: data.username,
        user_id: data.user_id,
        server_id: data.server_id,
        country: data.country
      });
    }

    return res.status(200).json({
      success: false,
      message: 'ID topilmadi'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'API xatosi'
    });
  }
}
