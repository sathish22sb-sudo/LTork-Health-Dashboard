/* ── APP MODULE ────────────────────────────────────────────────────────────── */
/* Main orchestrator: init, polling, UI rendering, state management.           */

const App = (() => {
  const POLL_INTERVAL_MS = 180000 // 3 minutes
  let pollTimer = null
  let countdownTimer = null
  let countdownSeconds = 180
  let isRefreshing = false

  /* ── INIT ──────────────────────────────────────────────────────────────── */
  function init() {
    applyTheme(Storage.getTheme())
    renderCards()
    updateFooterYear()
    Email.init()
    Notifications.requestPermission()
    bindEvents()
    refreshAll()
    startPolling()
  }

  /* ── EVENTS ────────────────────────────────────────────────────────────── */
  function bindEvents() {
    document.getElementById('refresh-btn').addEventListener('click', manualRefresh)
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme)
    document.getElementById('export-btn').addEventListener('click', Storage.exportAll)
    document.getElementById('search-input').addEventListener('input', filterCards)
  }

  /* ── THEME ─────────────────────────────────────────────────────────────── */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    Storage.setTheme(theme)
    // Redraw sparklines with new theme colors
    setTimeout(() => redrawAllCharts(), 100)
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme')
    applyTheme(current === 'dark' ? 'light' : 'dark')
  }

  /* ── CARD RENDERING ────────────────────────────────────────────────────── */
  function renderCards() {
    const grid = document.getElementById('api-cards-grid')
    const endpoints = API.getEndpoints()

    grid.innerHTML = endpoints.map(ep => `
      <div class="api-card unknown" id="card-${ep.key}" data-name="${ep.name.toLowerCase()}" data-url="${ep.url}">
        <div class="api-card-header">
          <div class="api-card-info">
            <div class="api-env-name">${ep.name}</div>
            <div class="api-url">${ep.url}</div>
          </div>
          <div class="status-badge unknown" id="badge-${ep.key}">
            <span class="dot"></span>
            <span id="badge-text-${ep.key}">Unknown</span>
          </div>
        </div>
        <div class="api-metrics">
          <div class="metric">
            <span class="metric-label">HTTP Status</span>
            <span class="metric-value" id="http-${ep.key}">—</span>
          </div>
          <div class="metric">
            <span class="metric-label">Response Time</span>
            <span class="metric-value" id="rt-${ep.key}">—</span>
          </div>
          <div class="metric">
            <span class="metric-label">Last Checked</span>
            <span class="metric-value" id="lc-${ep.key}">—</span>
          </div>
        </div>
        <div class="sparkline-container">
          <canvas id="chart-${ep.key}"></canvas>
          <span class="sparkline-label">Response Time</span>
        </div>
        <div class="uptime-row">
          <span class="metric-label">Uptime</span>
          <div class="uptime-bar-track">
            <div class="uptime-bar-fill good" id="uptime-bar-${ep.key}" style="width: 100%"></div>
          </div>
          <span class="uptime-pct good" id="uptime-pct-${ep.key}">100%</span>
        </div>
      </div>
    `).join('')
  }

  /* ── REFRESH ───────────────────────────────────────────────────────────── */
  async function refreshAll() {
    if (isRefreshing) return
    isRefreshing = true
    setCheckingState(true)

    try {
      const results = await API.checkAll()
      for (const result of results) {
        processResult(result)
      }
      updateSummary(results)
      updateLastRefresh()
    } catch (e) {
      console.error('Refresh failed:', e)
      Notifications.showToast('Failed to refresh health status', 'error')
    } finally {
      isRefreshing = false
      setCheckingState(false)
      resetCountdown()
    }
  }

  function processResult(result) {
    const { key, name, url, online, statusCode, responseTime, timestamp, error } = result
    const prevStatus = Storage.getLastStatus(key)

    // Store check
    Storage.addCheck(key, { online, statusCode, responseTime, timestamp, error })
    const history = Storage.getHistory(key)

    // Update card UI
    updateCard(result, history)

    // State change detection for alerts
    const currentStatus = online ? 'online' : 'offline'
    if (prevStatus !== null && prevStatus !== currentStatus) {
      // Status changed!
      if (prevStatus === 'online' && !online) {
        // Went DOWN
        Notifications.showToast(`${name} is DOWN`, 'error')
        Notifications.sendBrowserNotification(`${name} is DOWN`, `${url} is unreachable.`)
        Email.sendDownAlert(name, url, error || 'Server is unreachable or returned an unexpected response.')
      } else if (prevStatus === 'offline' && online) {
        // Recovered
        Notifications.showToast(`${name} is back ONLINE`, 'success')
        Notifications.sendBrowserNotification(`${name} Recovered`, `${url} is responding normally again.`)
        Email.sendRecoveryAlert(name, url)
      }
    } else if (prevStatus === null) {
      // First check — toast status
      if (!online) {
        Notifications.showToast(`${name} is DOWN`, 'error')
      }
    }

    Storage.setLastStatus(key, currentStatus)
  }

  function updateCard(result, history) {
    const { key, online, statusCode, responseTime, timestamp } = result
    const card = document.getElementById(`card-${key}`)
    const badge = document.getElementById(`badge-${key}`)
    const badgeText = document.getElementById(`badge-text-${key}`)
    const httpEl = document.getElementById(`http-${key}`)
    const rtEl = document.getElementById(`rt-${key}`)
    const lcEl = document.getElementById(`lc-${key}`)

    if (!card) return

    // Card state class
    card.className = card.className.replace(/(online|offline|checking|unknown)/g, '')
    card.classList.add(online ? 'online' : 'offline')

    // Badge
    badge.className = badge.className.replace(/(online|offline|checking|unknown)/g, '')
    badge.classList.add(online ? 'online' : 'offline')
    badgeText.textContent = online ? 'Online' : 'Offline'

    // HTTP status
    httpEl.textContent = statusCode || '—'
    httpEl.className = 'metric-value ' + (online ? 'green' : 'red')

    // Response time
    rtEl.textContent = responseTime ? `${responseTime}ms` : '—'
    rtEl.className = 'metric-value ' + (responseTime < 500 ? 'green' : responseTime < 2000 ? 'amber' : 'red')

    // Last checked
    lcEl.textContent = formatRelativeTime(timestamp)
    lcEl.className = 'metric-value'

    // Uptime
    const uptime = API.calcUptime(history)
    const uptimePct = document.getElementById(`uptime-pct-${key}`)
    const uptimeBar = document.getElementById(`uptime-bar-${key}`)
    if (uptimePct) {
      uptimePct.textContent = `${uptime}%`
      uptimePct.className = 'uptime-pct ' + (uptime >= 99 ? 'good' : uptime >= 95 ? 'warn' : 'bad')
    }
    if (uptimeBar) {
      uptimeBar.style.width = `${uptime}%`
      uptimeBar.className = 'uptime-bar-fill ' + (uptime >= 99 ? 'good' : uptime >= 95 ? 'warn' : 'bad')
    }

    // Sparkline
    const canvas = document.getElementById(`chart-${key}`)
    if (canvas) Charts.drawSparkline(canvas, history)
  }

  function updateSummary(results) {
    const healthy = results.filter(r => r.online).length
    const down = results.filter(r => !r.online).length

    document.getElementById('healthy-count').textContent = healthy
    document.getElementById('down-count').textContent = down
  }

  function updateLastRefresh() {
    const el = document.getElementById('last-refresh')
    if (el) el.textContent = formatTime(new Date())
  }

  /* ── CHECKING STATE ────────────────────────────────────────────────────── */
  function setCheckingState(checking) {
    const pollStatus = document.querySelector('.poll-status')
    const refreshIcon = document.getElementById('refresh-icon')
    const refreshBtn = document.getElementById('refresh-btn')

    if (checking) {
      pollStatus?.classList.add('checking')
      if (refreshIcon) refreshIcon.style.animation = 'spin 0.8s linear infinite'
      if (refreshBtn) refreshBtn.disabled = true
    } else {
      pollStatus?.classList.remove('checking')
      if (refreshIcon) refreshIcon.style.animation = ''
      if (refreshBtn) refreshBtn.disabled = false
    }
  }

  /* ── MANUAL REFRESH ────────────────────────────────────────────────────── */
  function manualRefresh() {
    if (isRefreshing) return
    refreshAll()
  }

  /* ── POLLING ───────────────────────────────────────────────────────────── */
  function startPolling() {
    resetCountdown()
    pollTimer = setInterval(refreshAll, POLL_INTERVAL_MS)
    countdownTimer = setInterval(tickCountdown, 1000)
  }

  function resetCountdown() {
    countdownSeconds = 180
    updateCountdownDisplay()
  }

  function tickCountdown() {
    countdownSeconds--
    if (countdownSeconds <= 0) countdownSeconds = 0
    updateCountdownDisplay()
  }

  function updateCountdownDisplay() {
    const min = Math.floor(countdownSeconds / 60)
    const sec = countdownSeconds % 60
    const el = document.getElementById('poll-text')
    if (el) el.textContent = `Auto-refresh in ${min}:${String(sec).padStart(2, '0')}`
  }

  /* ── SEARCH / FILTER ───────────────────────────────────────────────────── */
  function filterCards() {
    const query = document.getElementById('search-input').value.toLowerCase().trim()
    const cards = document.querySelectorAll('.api-card')
    cards.forEach(card => {
      const name = card.getAttribute('data-name') || ''
      const url = card.getAttribute('data-url') || ''
      const match = name.includes(query) || url.includes(query)
      card.style.display = match ? '' : 'none'
    })
  }

  /* ── CHARTS REDRAW ─────────────────────────────────────────────────────── */
  function redrawAllCharts() {
    const endpoints = API.getEndpoints()
    endpoints.forEach(ep => {
      const canvas = document.getElementById(`chart-${ep.key}`)
      const history = Storage.getHistory(ep.key)
      if (canvas && history.length > 0) {
        Charts.drawSparkline(canvas, history)
      }
    })
  }

  /* ── HELPERS ───────────────────────────────────────────────────────────── */
  function formatRelativeTime(isoString) {
    if (!isoString) return '—'
    const diff = Math.round((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diff < 5) return 'Just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  function updateFooterYear() {
    const el = document.getElementById('footer-year')
    if (el) el.textContent = new Date().getFullYear()
  }

  /* ── BOOT ──────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', init)

  return { refreshAll, toggleTheme }
})()
