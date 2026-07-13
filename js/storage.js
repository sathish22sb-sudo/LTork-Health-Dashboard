const Storage = (() => {
  const HISTORY_KEY = 'ltork_health_history'
  const STATUS_KEY = 'ltork_health_status'
  const THEME_KEY = 'ltork_health_theme'
  const MAX_HISTORY = 200
  const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch { return fallback }
  }

  function _write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }

  function _rotateHistory(all) {
    const cutoff = Date.now() - MAX_LOG_AGE_MS
    const result = {}
    for (const key of Object.keys(all)) {
      result[key] = all[key].filter(c => new Date(c.timestamp).getTime() > cutoff)
    }
    return result
  }

  function getHistory(apiKey) {
    const all = _rotateHistory(_read(HISTORY_KEY, {}))
    return all[apiKey] || []
  }

  function getAllHistory() {
    return _rotateHistory(_read(HISTORY_KEY, {}))
  }

  function addCheck(apiKey, checkData) {
    const all = _read(HISTORY_KEY, {})
    if (!all[apiKey]) all[apiKey] = []
    all[apiKey].push(checkData)
    if (all[apiKey].length > MAX_HISTORY) {
      all[apiKey] = all[apiKey].slice(-MAX_HISTORY)
    }
    const rotated = _rotateHistory(all)
    _write(HISTORY_KEY, rotated)
  }

  function getLastStatus(apiKey) {
    const all = _read(STATUS_KEY, {})
    return all[apiKey] || null
  }

  function setLastStatus(apiKey, status) {
    const all = _read(STATUS_KEY, {})
    all[apiKey] = status
    _write(STATUS_KEY, all)
  }

  function getTheme() {
    return _read(THEME_KEY, 'dark')
  }

  function setTheme(theme) {
    _write(THEME_KEY, theme)
  }

  function calcStats(history) {
    if (!history || history.length === 0) {
      return {
        totalChecks: 0, onlineChecks: 0, offlineChecks: 0,
        uptimePct: 100, avgResponseTime: 0, maxResponseTime: 0,
        minResponseTime: 0, p95ResponseTime: 0,
      }
    }
    const onlineChecks = history.filter(h => h.online).length
    const times = history.map(h => h.responseTime).filter(t => t > 0).sort((a, b) => a - b)
    const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
    const max = times.length ? times[times.length - 1] : 0
    const min = times.length ? times[0] : 0
    const p95 = times.length ? times[Math.floor(times.length * 0.95)] : 0
    return {
      totalChecks: history.length,
      onlineChecks,
      offlineChecks: history.length - onlineChecks,
      uptimePct: Math.round((onlineChecks / history.length) * 100),
      avgResponseTime: avg,
      maxResponseTime: max,
      minResponseTime: min,
      p95ResponseTime: p95,
    }
  }

  function calcHourlyDistribution(history) {
    const dist = Array(24).fill(0)
    history.forEach(h => {
      const hour = new Date(h.timestamp).getHours()
      dist[hour]++
    })
    return dist
  }

  function calcResponseTimeBuckets(history) {
    const buckets = { '<200ms': 0, '200-500ms': 0, '500-1s': 0, '1-2s': 0, '>2s': 0 }
    history.forEach(h => {
      const t = h.responseTime || 0
      if (t < 200) buckets['<200ms']++
      else if (t < 500) buckets['200-500ms']++
      else if (t < 1000) buckets['500-1s']++
      else if (t < 2000) buckets['1-2s']++
      else buckets['>2s']++
    })
    return buckets
  }

  function calcDailyUptime(history) {
    const dayMap = {}
    history.forEach(h => {
      const day = h.timestamp.slice(0, 10)
      if (!dayMap[day]) dayMap[day] = { total: 0, online: 0 }
      dayMap[day].total++
      if (h.online) dayMap[day].online++
    })
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        uptimePct: d.total > 0 ? Math.round((d.online / d.total) * 100) : 100,
        checks: d.total,
      }))
  }

  function exportAll() {
    const data = {
      exportedAt: new Date().toISOString(),
      history: _read(HISTORY_KEY, {}),
      statuses: _read(STATUS_KEY, {}),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ltork-health-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    getHistory, getAllHistory, addCheck,
    getLastStatus, setLastStatus,
    getTheme, setTheme, exportAll,
    calcStats, calcHourlyDistribution,
    calcResponseTimeBuckets, calcDailyUptime,
  }
})()
