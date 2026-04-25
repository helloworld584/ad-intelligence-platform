export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiUrl = process.env.VITE_API_URL

  try {
    const response = await fetch(`${apiUrl}/collect-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET
      }
    })
    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
