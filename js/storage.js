/* ── STORAGE MODULE ────────────────────────────────────────────────────────── */
/* LocalStorage helpers for health check history, status tracking, and prefs.   */

const Storage = (() => {
  const HISTORY_KEY = 'ltork_health_history'
  const STATUS_KEY = 'ltork_health_status'
  const THEME_KEY = 'ltork_health_theme'
  const MAX_HISTORY = 20

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch { return fallback }
  }

  function _write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }

  /* ── History (per API, last N checks) ──────────────────────────────────── */
  function getHistory(apiKey) {
    const all = _read(HISTORY_KEY, {})
    return all[apiKey] || []
  }

  function addCheck(apiKey, checkData) {
    const all = _read(HISTORY_KEY, {})
    if (!all[apiKey]) all[apiKey] = []
    all[apiKey].push(checkData)
    if (all[apiKey].length > MAX_HISTORY) all[apiKey] = all[apiKey].slice(-MAX_HISTORY)
    _write(HISTORY_KEY, all)
  }

  /* ── Previous status (for alert deduplication) ─────────────────────────── */
  function getLastStatus(apiKey) {
    const all = _read(STATUS_KEY, {})
    return all[apiKey] || null // null = first check ever
  }

  function setLastStatus(apiKey, status) {
    const all = _read(STATUS_KEY, {})
    all[apiKey] = status
    _write(STATUS_KEY, all)
  }

  /* ── Theme ─────────────────────────────────────────────────────────────── */
  function getTheme() {
    return _read(THEME_KEY, 'dark')
  }

  function setTheme(theme) {
    _write(THEME_KEY, theme)
  }

  /* ── Export ────────────────────────────────────────────────────────────── */
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

  return { getHistory, addCheck, getLastStatus, setLastStatus, getTheme, setTheme, exportAll }
})()
