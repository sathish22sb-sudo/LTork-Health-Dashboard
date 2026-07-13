const Charts = (() => {
  const COLORS = {
    green: '#34d399',
    greenBg: 'rgba(52,211,153,0.15)',
    red: '#f87171',
    redBg: 'rgba(248,113,113,0.15)',
    amber: '#fbbf24',
    amberBg: 'rgba(251,191,36,0.15)',
    accent: '#818cf8',
    accentBg: 'rgba(129,140,248,0.15)',
    purple: '#c084fc',
    purpleBg: 'rgba(192,132,252,0.15)',
    text: '#94a3b8',
    textMuted: '#64748b',
    grid: 'rgba(148,163,184,0.08)',
  }

  function getThemeColors() {
    const cs = getComputedStyle(document.documentElement)
    return {
      green: cs.getPropertyValue('--green').trim() || COLORS.green,
      red: cs.getPropertyValue('--red').trim() || COLORS.red,
      amber: cs.getPropertyValue('--amber').trim() || COLORS.amber,
      accent: cs.getPropertyValue('--accent').trim() || COLORS.accent,
      text: cs.getPropertyValue('--text-secondary').trim() || COLORS.text,
      textMuted: cs.getPropertyValue('--text-muted').trim() || COLORS.textMuted,
    }
  }

  function setupCanvas(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const cw = w || rect.width
    const ch = h || rect.height
    canvas.width = cw * dpr
    canvas.height = ch * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    return { ctx, w: cw, h: ch }
  }

  function drawSparkline(canvas, history) {
    if (!canvas || !history || history.length === 0) return
    const { ctx, w, h } = setupCanvas(canvas)
    const tc = getThemeColors()
    const pad = 4
    const times = history.map(e => e.responseTime || 0)
    const maxT = Math.max(...times, 100)
    const range = maxT || 1

    const anyDown = history.some(e => !e.online)
    const lineColor = anyDown ? tc.red : tc.green

    const pts = history.map((e, i) => ({
      x: pad + (i / Math.max(history.length - 1, 1)) * (w - pad * 2),
      y: pad + (1 - (e.responseTime - 0) / range) * (h - pad * 2),
      online: e.online,
    }))

    ctx.beginPath()
    ctx.moveTo(pts[0].x, h)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, h)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, lineColor + '30')
    grad.addColorStop(1, lineColor + '05')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.8
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    pts.forEach(p => {
      if (!p.online) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = tc.red
        ctx.fill()
      }
    })

    if (pts.length > 0) {
      const last = pts[pts.length - 1]
      ctx.beginPath()
      ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = lineColor
      ctx.fill()
    }
  }

  function drawResponseTimeChart(canvas, history) {
    if (!canvas || !history || history.length === 0) return
    const { ctx, w, h } = setupCanvas(canvas)
    const tc = getThemeColors()
    const pad = { top: 20, right: 16, bottom: 28, left: 50 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom

    const times = history.map(e => e.responseTime || 0)
    const maxT = Math.max(...times, 200)
    const gridLines = 5

    ctx.font = '10px JetBrains Mono, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (i / gridLines) * ch
      const val = Math.round(maxT - (i / gridLines) * maxT)
      ctx.fillStyle = tc.textMuted
      ctx.fillText(`${val}ms`, pad.left - 8, y)
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const pts = history.map((e, i) => ({
      x: pad.left + (i / Math.max(history.length - 1, 1)) * cw,
      y: pad.top + (1 - (e.responseTime || 0) / maxT) * ch,
      online: e.online,
    }))

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pad.top + ch)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, pad.top + ch)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch)
    grad.addColorStop(0, tc.accent + '35')
    grad.addColorStop(1, tc.accent + '05')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = tc.accent
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    pts.forEach(p => {
      if (!p.online) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = tc.red
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
        ctx.strokeStyle = tc.red + '40'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    if (pts.length > 0) {
      const last = pts[pts.length - 1]
      ctx.beginPath()
      ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = tc.accent
      ctx.fill()
      ctx.beginPath()
      ctx.arc(last.x, last.y, 7, 0, Math.PI * 2)
      ctx.strokeStyle = tc.accent + '40'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    const labelStep = Math.max(1, Math.floor(pts.length / 8))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i < pts.length; i += labelStep) {
      const ts = history[i].timestamp
      const d = new Date(ts)
      const label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      ctx.fillStyle = tc.textMuted
      ctx.fillText(label, pts[i].x, pad.top + ch + 6)
    }
  }

  function drawHourlyBarChart(canvas, distribution) {
    if (!canvas || !distribution) return
    const { ctx, w, h } = setupCanvas(canvas)
    const tc = getThemeColors()
    const pad = { top: 16, right: 12, bottom: 28, left: 36 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom
    const maxV = Math.max(...distribution, 1)
    const barW = cw / 24 - 2

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * ch
      const val = Math.round(maxV - (i / 4) * maxV)
      ctx.fillStyle = tc.textMuted
      ctx.font = '9px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(val, pad.left - 6, y)
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    distribution.forEach((val, i) => {
      const x = pad.left + (i / 24) * cw + 1
      const barH = (val / maxV) * ch
      const y = pad.top + ch - barH

      const grad = ctx.createLinearGradient(0, y, 0, pad.top + ch)
      grad.addColorStop(0, tc.accent)
      grad.addColorStop(1, tc.accent + '30')
      ctx.fillStyle = grad

      const r = 2
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, pad.top + ch)
      ctx.lineTo(x, pad.top + ch)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.fill()

      if (i % 3 === 0) {
        ctx.fillStyle = tc.textMuted
        ctx.font = '9px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`${i}h`, x + barW / 2, pad.top + ch + 6)
      }
    })
  }

  function drawResponseTimeDistribution(canvas, buckets) {
    if (!canvas || !buckets) return
    const { ctx, w, h } = setupCanvas(canvas)
    const tc = getThemeColors()
    const pad = { top: 16, right: 12, bottom: 4, left: 80 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom
    const keys = Object.keys(buckets)
    const maxV = Math.max(...Object.values(buckets), 1)
    const barH = ch / keys.length - 3

    const bucketColors = [tc.green, tc.accent, tc.amber, '#fb923c', tc.red]

    keys.forEach((label, i) => {
      const y = pad.top + i * (barH + 3)
      const val = buckets[label]
      const barW = (val / maxV) * cw

      ctx.fillStyle = tc.textMuted
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, pad.left - 8, y + barH / 2)

      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + barW, 0)
      grad.addColorStop(0, bucketColors[i] || tc.accent)
      grad.addColorStop(1, (bucketColors[i] || tc.accent) + '50')
      ctx.fillStyle = grad

      const r = 3
      ctx.beginPath()
      ctx.moveTo(pad.left + r, y)
      ctx.lineTo(pad.left + barW - r, y)
      ctx.quadraticCurveTo(pad.left + barW, y, pad.left + barW, y + r)
      ctx.lineTo(pad.left + barW, y + barH - r)
      ctx.quadraticCurveTo(pad.left + barW, y + barH, pad.left + barW - r, y + barH)
      ctx.lineTo(pad.left + r, y + barH)
      ctx.quadraticCurveTo(pad.left, y + barH, pad.left, y + barH - r)
      ctx.lineTo(pad.left, y + r)
      ctx.quadraticCurveTo(pad.left, y, pad.left + r, y)
      ctx.fill()

      ctx.fillStyle = tc.text
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'left'
      ctx.fillText(val, pad.left + barW + 8, y + barH / 2)
    })
  }

  function drawDailyUptimeChart(canvas, dailyUptime) {
    if (!canvas || !dailyUptime || dailyUptime.length === 0) return
    const { ctx, w, h } = setupCanvas(canvas)
    const tc = getThemeColors()
    const pad = { top: 16, right: 16, bottom: 28, left: 42 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * ch
      const val = Math.round(100 - (i / 4) * 100)
      ctx.fillStyle = tc.textMuted
      ctx.font = '9px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${val}%`, pad.left - 6, y)
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const pts = dailyUptime.map((d, i) => ({
      x: pad.left + (i / Math.max(dailyUptime.length - 1, 1)) * cw,
      y: pad.top + (1 - d.uptimePct / 100) * ch,
      uptime: d.uptimePct,
      date: d.date,
    }))

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pad.top + ch)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, pad.top + ch)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch)
    grad.addColorStop(0, tc.green + '35')
    grad.addColorStop(1, tc.green + '05')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = tc.green
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    pts.forEach(p => {
      const c = p.uptime >= 99 ? tc.green : p.uptime >= 95 ? tc.amber : tc.red
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
    })

    if (pts.length > 1) {
      const labelStep = Math.max(1, Math.floor(pts.length / 6))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.font = '9px JetBrains Mono, monospace'
      for (let i = 0; i < pts.length; i += labelStep) {
        ctx.fillStyle = tc.textMuted
        ctx.fillText(pts[i].date.slice(5), pts[i].x, pad.top + ch + 6)
      }
    }
  }

  return {
    drawSparkline,
    drawResponseTimeChart,
    drawHourlyBarChart,
    drawResponseTimeDistribution,
    drawDailyUptimeChart,
  }
})()
