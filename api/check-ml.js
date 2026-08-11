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
        method: 'GET',
        headers: {
          'x-api-key': process.env.ALUU_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (data.success === true) {
      return res.status(200).json({
        success: true,
        username: data.username,
        country: data.country,
        user_id: data.user_id,
        server_id: data.server_id
      });
    }

    return res.status(200).json({
      success: false,
      message: data.message || 'ID topilmadi'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
// redeploy
