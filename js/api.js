/* ── API MODULE ────────────────────────────────────────────────────────────── */
/* Health check logic: fetch both endpoints, measure response time.            */

const API = (() => {
  const ENDPOINTS = [
    { name: 'Stage API', url: 'https://stage.api.ltorkcontrols.com/health', key: 'stage' },
    { name: 'Live API', url: 'https://api.ltorkcontrols.com/health', key: 'live' },
  ]

  const TIMEOUT_MS = 10000

  function getEndpoints() {
    return ENDPOINTS
  }

  /**
   * Check a single health endpoint.
   * Returns: { name, key, url, online, statusCode, responseTime, timestamp, error }
   */
  async function checkHealth(endpoint) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const start = performance.now()

    try {
      const res = await fetch(endpoint.url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      })
      const elapsed = Math.round(performance.now() - start)
      clearTimeout(timer)

      const contentType = res.headers.get('content-type') || ''
      let body = null
      if (contentType.includes('application/json')) {
        body = await res.json().catch(() => null)
      }

      const online = res.ok && body && body.status === 'ok'

      return {
        name: endpoint.name,
        key: endpoint.key,
        url: endpoint.url,
        online,
        statusCode: res.status,
        responseTime: elapsed,
        timestamp: new Date().toISOString(),
        error: online ? null : `Status: ${res.status}`,
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start)
      clearTimeout(timer)

      let errorMsg = 'Network error'
      if (err.name === 'AbortError') errorMsg = `Timeout (>${TIMEOUT_MS / 1000}s)`
      else if (err.message) errorMsg = err.message

      return {
        name: endpoint.name,
        key: endpoint.key,
        url: endpoint.url,
        online: false,
        statusCode: 0,
        responseTime: elapsed,
        timestamp: new Date().toISOString(),
        error: errorMsg,
      }
    }
  }

  /**
   * Check all endpoints in parallel.
   * Returns array of results.
   */
  async function checkAll() {
    const results = await Promise.all(ENDPOINTS.map(checkHealth))
    return results
  }

  /**
   * Calculate uptime percentage from history.
   */
  function calcUptime(history) {
    if (!history || history.length === 0) return 100
    const onlineCount = history.filter(h => h.online).length
    return Math.round((onlineCount / history.length) * 100)
  }

  return { getEndpoints, checkHealth, checkAll, calcUptime }
})()
