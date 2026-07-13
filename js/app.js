const App = (() => {
  const POLL_INTERVAL_MS = 180000
  let pollTimer = null
  let countdownTimer = null
  let countdownSeconds = 180
  let isRefreshing = false
  let activeModal = null

  function init() {
    applyTheme(Storage.getTheme())
    renderSummaryCards()
    renderApiCards()
    updateFooterYear()
    Email.init()
    Notifications.requestPermission()
    bindEvents()
    refreshAll()
    startPolling()
  }

  function bindEvents() {
    document.getElementById('refresh-btn').addEventListener('click', manualRefresh)
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme)
    document.getElementById('export-btn').addEventListener('click', Storage.exportAll)
    document.getElementById('search-input').addEventListener('input', filterCards)
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    Storage.setTheme(theme)
    setTimeout(() => redrawAllCharts(), 100)
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme')
    applyTheme(current === 'dark' ? 'light' : 'dark')
  }

  /* ── SUMMARY CARDS ───────────────────────────────────────────────────── */
  function renderSummaryCards() {
    const endpoints = API.getEndpoints()
    const allHistory = Storage.getAllHistory()
    let totalChecks = 0, healthy = 0, down = 0, avgRT = 0, rtCount = 0

    endpoints.forEach(ep => {
      const h = allHistory[ep.key] || []
      totalChecks += h.length
      h.forEach(c => {
        if (c.online) healthy++
        else down++
        if (c.responseTime > 0) { avgRT += c.responseTime; rtCount++ }
      })
    })
    avgRT = rtCount > 0 ? Math.round(avgRT / rtCount) : 0

    document.getElementById('total-apis').textContent = endpoints.length
    document.getElementById('healthy-count').textContent = endpoints.length - down
    document.getElementById('down-count').textContent = down > 0 ? 1 : 0
    document.getElementById('total-checks').textContent = totalChecks.toLocaleString()
    document.getElementById('avg-rt').textContent = avgRT > 0 ? `${avgRT}ms` : '—'
  }

  function updateSummaryFromResults(results) {
    const endpoints = API.getEndpoints()
    const healthy = results.filter(r => r.online).length
    const down = results.filter(r => !r.online).length

    document.getElementById('healthy-count').textContent = healthy
    document.getElementById('down-count').textContent = down
  }

  /* ── API CARDS ───────────────────────────────────────────────────────── */
  function renderApiCards() {
    const grid = document.getElementById('api-cards-grid')
    const endpoints = API.getEndpoints()

    grid.innerHTML = endpoints.map(ep => `
      <div class="api-card unknown" id="card-${ep.key}" data-key="${ep.key}" data-name="${ep.name.toLowerCase()}" data-url="${ep.url}">
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
        <div class="api-extra-stats" id="extra-stats-${ep.key}"></div>
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
        <button class="btn-detail" data-key="${ep.key}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          View Details
        </button>
      </div>
    `).join('')

    grid.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        openDetailModal(btn.dataset.key)
      })
    })
  }

  function updateExtraStats(key, history) {
    const el = document.getElementById(`extra-stats-${key}`)
    if (!el || history.length === 0) { if (el) el.innerHTML = ''; return }

    const stats = Storage.calcStats(history)
    el.innerHTML = `
      <div class="extra-stat">
        <span class="extra-stat-value">${stats.totalChecks}</span>
        <span class="extra-stat-label">Checks</span>
      </div>
      <div class="extra-stat">
        <span class="extra-stat-value">${stats.avgResponseTime}ms</span>
        <span class="extra-stat-label">Avg RT</span>
      </div>
      <div class="extra-stat">
        <span class="extra-stat-value">${stats.p95ResponseTime}ms</span>
        <span class="extra-stat-label">P95</span>
      </div>
      <div class="extra-stat">
        <span class="extra-stat-value">${stats.maxResponseTime}ms</span>
        <span class="extra-stat-label">Max RT</span>
      </div>
    `
  }

  /* ── REFRESH ─────────────────────────────────────────────────────────── */
  async function refreshAll() {
    if (isRefreshing) return
    isRefreshing = true
    setCheckingState(true)

    try {
      const results = await API.checkAll()
      for (const result of results) {
        processResult(result)
      }
      renderSummaryCards()
      updateSummaryFromResults(results)
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

    Storage.addCheck(key, { online, statusCode, responseTime, timestamp, error })
    const history = Storage.getHistory(key)

    updateCard(result, history)
    updateExtraStats(key, history)

    const currentStatus = online ? 'online' : 'offline'
    if (prevStatus !== null && prevStatus !== currentStatus) {
      if (prevStatus === 'online' && !online) {
        Notifications.showToast(`${name} is DOWN`, 'error')
        Notifications.sendBrowserNotification(`${name} is DOWN`, `${url} is unreachable.`)
        Email.sendDownAlert(name, url, error || 'Server is unreachable or returned an unexpected response.')
      } else if (prevStatus === 'offline' && online) {
        Notifications.showToast(`${name} is back ONLINE`, 'success')
        Notifications.sendBrowserNotification(`${name} Recovered`, `${url} is responding normally again.`)
        Email.sendRecoveryAlert(name, url)
      }
    } else if (prevStatus === null) {
      if (!online) Notifications.showToast(`${name} is DOWN`, 'error')
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

    card.className = card.className.replace(/(online|offline|checking|unknown)/g, '')
    card.classList.add(online ? 'online' : 'offline')

    badge.className = badge.className.replace(/(online|offline|checking|unknown)/g, '')
    badge.classList.add(online ? 'online' : 'offline')
    badgeText.textContent = online ? 'Online' : 'Offline'

    httpEl.textContent = statusCode || '—'
    httpEl.className = 'metric-value ' + (online ? 'green' : 'red')

    rtEl.textContent = responseTime ? `${responseTime}ms` : '—'
    rtEl.className = 'metric-value ' + (responseTime < 500 ? 'green' : responseTime < 2000 ? 'amber' : 'red')

    lcEl.textContent = formatRelativeTime(timestamp)
    lcEl.className = 'metric-value'

    const uptime = Storage.calcStats(history).uptimePct
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

    const canvas = document.getElementById(`chart-${key}`)
    if (canvas) Charts.drawSparkline(canvas, history)
  }

  /* ── DETAIL MODAL ────────────────────────────────────────────────────── */
  function openDetailModal(key) {
    const endpoints = API.getEndpoints()
    const ep = endpoints.find(e => e.key === key)
    if (!ep) return

    const history = Storage.getHistory(key)
    const stats = Storage.calcStats(history)
    const hourly = Storage.calcHourlyDistribution(history)
    const rtBuckets = Storage.calcResponseTimeBuckets(history)
    const dailyUptime = Storage.calcDailyUptime(history)

    const modal = document.getElementById('detail-modal')
    modal.querySelector('.modal-title').textContent = `${ep.name} — Detailed Insights`
    modal.querySelector('.modal-subtitle').textContent = ep.url

    document.getElementById('detail-total-checks').textContent = stats.totalChecks
    document.getElementById('detail-online').textContent = stats.onlineChecks
    document.getElementById('detail-offline').textContent = stats.offlineChecks
    document.getElementById('detail-uptime').textContent = `${stats.uptimePct}%`
    document.getElementById('detail-avg-rt').textContent = `${stats.avgResponseTime}ms`
    document.getElementById('detail-min-rt').textContent = `${stats.minResponseTime}ms`
    document.getElementById('detail-max-rt').textContent = `${stats.maxResponseTime}ms`
    document.getElementById('detail-p95-rt').textContent = `${stats.p95ResponseTime}ms`

    const tbody = document.getElementById('detail-history-tbody')
    tbody.innerHTML = ''
    const sorted = [...history].reverse().slice(0, 100)
    sorted.forEach(entry => {
      const tr = document.createElement('tr')
      const d = new Date(entry.timestamp)
      const timeStr = d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      tr.innerHTML = `
        <td class="td-time">${timeStr}</td>
        <td><span class="status-dot-inline ${entry.online ? 'online' : 'offline'}"></span>${entry.online ? 'Online' : 'Offline'}</td>
        <td class="td-mono">${entry.statusCode || '—'}</td>
        <td class="td-mono">${entry.responseTime}ms</td>
        <td class="td-error">${entry.error || '—'}</td>
      `
      tbody.appendChild(tr)
    })

    modal.classList.add('open')
    document.body.style.overflow = 'hidden'
    activeModal = key

    requestAnimationFrame(() => {
      const rtCanvas = document.getElementById('detail-chart-rt')
      const hourlyCanvas = document.getElementById('detail-chart-hourly')
      const distCanvas = document.getElementById('detail-chart-dist')
      const uptimeCanvas = document.getElementById('detail-chart-uptime')

      if (rtCanvas) Charts.drawResponseTimeChart(rtCanvas, history)
      if (hourlyCanvas) Charts.drawHourlyBarChart(hourlyCanvas, hourly)
      if (distCanvas) Charts.drawResponseTimeDistribution(distCanvas, rtBuckets)
      if (uptimeCanvas) Charts.drawDailyUptimeChart(uptimeCanvas, dailyUptime)
    })
  }

  function closeDetailModal() {
    const modal = document.getElementById('detail-modal')
    modal.classList.remove('open')
    document.body.style.overflow = ''
    activeModal = null
  }

  function setupModalEvents() {
    const modal = document.getElementById('detail-modal')
    modal.querySelector('.modal-close').addEventListener('click', closeDetailModal)
    modal.querySelector('.modal-overlay').addEventListener('click', closeDetailModal)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeModal) closeDetailModal()
    })
  }

  /* ── CHECKING STATE ──────────────────────────────────────────────────── */
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

  function manualRefresh() {
    if (isRefreshing) return
    refreshAll()
  }

  /* ── POLLING ─────────────────────────────────────────────────────────── */
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

  /* ── SEARCH / FILTER ─────────────────────────────────────────────────── */
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

  /* ── CHARTS REDRAW ───────────────────────────────────────────────────── */
  function redrawAllCharts() {
    const endpoints = API.getEndpoints()
    endpoints.forEach(ep => {
      const canvas = document.getElementById(`chart-${ep.key}`)
      const history = Storage.getHistory(ep.key)
      if (canvas && history.length > 0) Charts.drawSparkline(canvas, history)
    })
    if (activeModal) openDetailModal(activeModal)
  }

  /* ── HELPERS ─────────────────────────────────────────────────────────── */
  function formatRelativeTime(isoString) {
    if (!isoString) return '—'
    const diff = Math.round((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diff < 5) return 'Just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  function updateFooterYear() {
    const el = document.getElementById('footer-year')
    if (el) el.textContent = new Date().getFullYear()
  }

  /* ── BOOT ────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    init()
    setupModalEvents()
  })

  return { refreshAll, toggleTheme }
})()
