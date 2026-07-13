/* ── CHARTS MODULE ─────────────────────────────────────────────────────────── */
/* Mini sparkline charts for response time history. Pure canvas 2D, no libs.   */

const Charts = (() => {
  /**
   * Draw a sparkline chart on a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{responseTime: number, online: boolean}>} history
   */
  function drawSparkline(canvas, history) {
    if (!canvas || !history || history.length === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const pad = 4

    const times = history.map(h => h.responseTime || 0)
    const maxTime = Math.max(...times, 100)
    const minTime = 0
    const range = maxTime - minTime || 1

    // Determine line color based on overall status
    const allOnline = history.every(h => h.online)
    const anyDown = history.some(h => !h.online)
    const lineColor = anyDown
      ? getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#f87171'
      : allOnline
        ? getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#34d399'
        : getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#fbbf24'

    // Build points
    const points = history.map((entry, i) => ({
      x: pad + (i / Math.max(history.length - 1, 1)) * (w - pad * 2),
      y: pad + (1 - (entry.responseTime - minTime) / range) * (h - pad * 2),
      online: entry.online,
    }))

    // Fill area
    ctx.beginPath()
    ctx.moveTo(points[0].x, h)
    points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1].x, h)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, lineColor + '30')
    gradient.addColorStop(1, lineColor + '05')
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw line
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.8
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    // Draw dots for offline checks
    points.forEach(p => {
      if (!p.online) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#f87171'
        ctx.fill()
      }
    })

    // Draw last point dot
    if (points.length > 0) {
      const last = points[points.length - 1]
      ctx.beginPath()
      ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = lineColor
      ctx.fill()
    }
  }

  return { drawSparkline }
})()
