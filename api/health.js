export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { url } = req.query
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter' })
  }

  let targetUrl
  try {
    targetUrl = new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  const allowedHosts = ['stage.api.ltorkcontrols.com', 'api.ltorkcontrols.com']
  if (!allowedHosts.includes(targetUrl.hostname)) {
    return res.status(403).json({ error: 'Host not allowed' })
  }

  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(targetUrl.href, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)

    const elapsed = Date.now() - start
    const contentType = response.headers.get('content-type') || ''
    let body = null
    if (contentType.includes('application/json')) {
      body = await response.json().catch(() => null)
    }

    const online = response.ok && body && body.status === 'ok'

    return res.status(200).json({
      online,
      statusCode: response.status,
      responseTime: elapsed,
      timestamp: new Date().toISOString(),
      error: online ? null : `Status: ${response.status}`,
    })
  } catch (err) {
    const elapsed = Date.now() - start
    let errorMsg = 'Network error'
    if (err.name === 'AbortError') errorMsg = 'Timeout (>10s)'
    else if (err.message) errorMsg = err.message

    return res.status(200).json({
      online: false,
      statusCode: 0,
      responseTime: elapsed,
      timestamp: new Date().toISOString(),
      error: errorMsg,
    })
  }
}
