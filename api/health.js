import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const LOG_DIR = join(tmpdir(), 'health-logs')
const LOG_FILE = join(LOG_DIR, 'checks.json')
const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_LOG_ENTRIES = 5000

async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) await mkdir(LOG_DIR, { recursive: true })
}

async function readLogs() {
  try {
    if (!existsSync(LOG_FILE)) return []
    const raw = await readFile(LOG_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch { return [] }
}

async function appendLog(entry) {
  await ensureLogDir()
  let logs = []
  try {
    if (existsSync(LOG_FILE)) {
      const raw = await readFile(LOG_FILE, 'utf-8')
      logs = JSON.parse(raw)
    }
  } catch { logs = [] }

  const cutoff = Date.now() - MAX_LOG_AGE_MS
  logs = logs.filter(l => new Date(l.timestamp).getTime() > cutoff)
  logs.push(entry)
  if (logs.length > MAX_LOG_ENTRIES) logs = logs.slice(-MAX_LOG_ENTRIES)
  await writeFile(LOG_FILE, JSON.stringify(logs), 'utf-8')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'Missing "url" query parameter' })

  let targetUrl
  try { targetUrl = new URL(url) } catch { return res.status(400).json({ error: 'Invalid URL' }) }

  const allowedHosts = ['stage.api.ltorkcontrols.com', 'api.ltorkcontrols.com']
  if (!allowedHosts.includes(targetUrl.hostname)) {
    return res.status(403).json({ error: 'Host not allowed' })
  }

  const start = Date.now()
  let result
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
    result = {
      online,
      statusCode: response.status,
      responseTime: elapsed,
      timestamp: new Date().toISOString(),
      error: online ? null : `Status: ${response.status}`,
    }
  } catch (err) {
    const elapsed = Date.now() - start
    let errorMsg = 'Network error'
    if (err.name === 'AbortError') errorMsg = 'Timeout (>10s)'
    else if (err.message) errorMsg = err.message

    result = {
      online: false,
      statusCode: 0,
      responseTime: elapsed,
      timestamp: new Date().toISOString(),
      error: errorMsg,
    }
  }

  const logKey = targetUrl.hostname.includes('stage') ? 'stage' : 'live'
  appendLog({
    key: logKey,
    url: targetUrl.href,
    online: result.online,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    timestamp: result.timestamp,
    error: result.error,
  }).catch(() => {})

  return res.status(200).json(result)
}
