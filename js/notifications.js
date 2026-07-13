/* ── NOTIFICATIONS MODULE ──────────────────────────────────────────────────── */
/* Toast notifications + browser Notification API.                             */

const Notifications = (() => {
  const TOAST_DURATION = 5000

  const ICONS = {
    success: '&#10003;',
    error: '&#10007;',
    warning: '&#9888;',
    info: '&#8505;',
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container')
    if (!container) return

    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.innerHTML = `<span class="toast-icon">${ICONS[type] || ICONS.info}</span><span>${message}</span>`
    container.appendChild(toast)

    setTimeout(() => {
      toast.classList.add('fade-out')
      toast.addEventListener('animationend', () => toast.remove())
    }, TOAST_DURATION)
  }

  /**
   * Request browser notification permission.
   */
  function requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  /**
   * Send a browser notification (system notification).
   * @param {string} title
   * @param {string} body
   */
  function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🟢</text></svg>',
        })
      } catch {}
    }
  }

  return { showToast, requestPermission, sendBrowserNotification }
})()
