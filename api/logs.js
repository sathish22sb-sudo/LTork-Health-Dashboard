import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const LOG_DIR = join(tmpdir(), 'health-logs')
const LOG_FILE = join(LOG_DIR, 'checks.json')
const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000

async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) await mkdir(LOG_DIR, { recursive: true })
}

async function readLogs() {
  try {
    if (!existsSync(LOG_FILE)) return []
    const raw = await readFile(LOG_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeLogs(logs) {
  await ensureLogDir()
  await writeFile(LOG_FILE, JSON.stringify(logs), 'utf-8')
}

function rotateLogs(logs) {
  const cutoff = Date.now() - MAX_LOG_AGE_MS
  return logs.filter(l => new Date(l.timestamp).getTime() > cutoff)
}

function computeStats(logs) {
  if (logs.length === 0) {
    return {
      totalChecks: 0,
      onlineChecks: 0,
      offlineChecks: 0,
      uptimePct: 100,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
    }
  }

  const onlineChecks = logs.filter(l => l.online).length
  const offlineChecks = logs.length - onlineChecks
  const times = logs.map(l => l.responseTime).filter(t => t > 0).sort((a, b) => a - b)

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
  const max = times.length ? times[times.length - 1] : 0
  const min = times.length ? times[0] : 0
  const p95 = times.length ? times[Math.floor(times.length * 0.95)] : 0
  const p99 = times.length ? times[Math.floor(times.length * 0.99)] : 0

  return {
    totalChecks: logs.length,
    onlineChecks,
    offlineChecks,
    uptimePct: Math.round((onlineChecks / logs.length) * 100),
    avgResponseTime: avg,
    maxResponseTime: max,
    minResponseTime: min,
    p95ResponseTime: p95,
    p99ResponseTime: p99,
  }
}

function computeHourlyDistribution(logs) {
  const dist = Array(24).fill(0)
  logs.forEach(l => {
    const hour = new Date(l.timestamp).getUTCHours()
    dist[hour]++
  })
  return dist
}

function computeDailyUptime(logs) {
  const dayMap = {}
  logs.forEach(l => {
    const day = l.timestamp.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = { total: 0, online: 0 }
    dayMap[day].total++
    if (l.online) dayMap[day].online++
  })
  return Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      uptimePct: d.total > 0 ? Math.round((d.online / d.total) * 100) : 100,
      checks: d.total,
    }))
}

function computeResponseTimeBuckets(logs) {
  const buckets = { '<200ms': 0, '200-500ms': 0, '500-1000ms': 0, '1000-2000ms': 0, '>2000ms': 0 }
  logs.forEach(l => {
    const t = l.responseTime
    if (t < 200) buckets['<200ms']++
    else if (t < 500) buckets['200-500ms']++
    else if (t < 1000) buckets['500-1000ms']++
    else if (t < 2000) buckets['1000-2000ms']++
    else buckets['>2000ms']++
  })
  return buckets
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  let logs = await readLogs()
  const rotated = rotateLogs(logs)
  if (rotated.length < logs.length) await writeLogs(rotated)
  logs = rotated

  const { key, since, until, limit, page } = req.query
  let filtered = logs
  if (key) filtered = filtered.filter(l => l.key === key)
  if (since) filtered = filtered.filter(l => new Date(l.timestamp) >= new Date(since))
  if (until) filtered = filtered.filter(l => new Date(l.timestamp) <= new Date(until))

  const pageSize = parseInt(limit, 10) || 50
  const pageNum = parseInt(page, 10) || 1
  const startIdx = (pageNum - 1) * pageSize
  const paged = filtered.slice(startIdx, startIdx + pageSize)

  const statsByEndpoint = {}
  const keys = [...new Set(logs.map(l => l.key))]
  keys.forEach(k => {
    statsByEndpoint[k] = computeStats(logs.filter(l => l.key === k))
  })

  return res.status(200).json({
    logs: paged,
    pagination: {
      total: filtered.length,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize),
    },
    stats: {
      overall: computeStats(logs),
      byEndpoint: statsByEndpoint,
      hourlyDistribution: computeHourlyDistribution(logs),
      dailyUptime: computeDailyUptime(logs),
      responseTimeBuckets: computeResponseTimeBuckets(logs),
    },
    rotation: {
      oldestEntry: logs.length > 0 ? logs[0].timestamp : null,
      newestEntry: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
      maxAgeDays: 7,
    },
  })
}
