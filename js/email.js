/* ── EMAIL MODULE ──────────────────────────────────────────────────────────── */
/* EmailJS integration for health alert emails.                                 */

const Email = (() => {
  /* ── Configuration — update these after creating templates in EmailJS ──── */
  const CONFIG = {
    PUBLIC_KEY: 'fZQUFQff4QwX2i_ky',
    SERVICE_ID: 'service_xz7b2qp',
    DOWN_TEMPLATE_ID: 'YOUR_DOWN_TEMPLATE_ID',
    RECOVERY_TEMPLATE_ID: 'YOUR_RECOVERY_TEMPLATE_ID',
  }

  const RECIPIENTS = [
    'sathishsrini499@gmail.com',
    'freelearner505@gmail.com',
  ]

  let initialized = false

  function init() {
    if (initialized) return
    try {
      emailjs.init({ publicKey: CONFIG.PUBLIC_KEY })
      initialized = true
    } catch (e) {
      console.error('EmailJS init failed:', e)
    }
  }

  /**
   * Send a "down" alert email.
   * @param {string} envName - e.g. "Stage API"
   * @param {string} url - the health endpoint URL
   * @param {string} reason - error description
   */
  async function sendDownAlert(envName, url, reason) {
    if (!initialized) init()
    if (CONFIG.DOWN_TEMPLATE_ID === 'YOUR_DOWN_TEMPLATE_ID') {
      console.warn('Email alert skipped: DOWN_TEMPLATE_ID not configured')
      return false
    }

    const templateParams = {
      environment: envName,
      status: 'DOWN',
      url: url,
      time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      reason: reason || 'Server is unreachable or returned an unexpected response.',
      to_emails: RECIPIENTS.join(', '),
    }

    try {
      await emailjs.send(CONFIG.SERVICE_ID, CONFIG.DOWN_TEMPLATE_ID, templateParams)
      return true
    } catch (e) {
      console.error('Failed to send down alert:', e)
      return false
    }
  }

  /**
   * Send a "recovery" alert email.
   * @param {string} envName - e.g. "Live API"
   * @param {string} url - the health endpoint URL
   */
  async function sendRecoveryAlert(envName, url) {
    if (!initialized) init()
    if (CONFIG.RECOVERY_TEMPLATE_ID === 'YOUR_RECOVERY_TEMPLATE_ID') {
      console.warn('Email alert skipped: RECOVERY_TEMPLATE_ID not configured')
      return false
    }

    const templateParams = {
      environment: envName,
      status: 'ONLINE',
      url: url,
      time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      to_emails: RECIPIENTS.join(', '),
    }

    try {
      await emailjs.send(CONFIG.SERVICE_ID, CONFIG.RECOVERY_TEMPLATE_ID, templateParams)
      return true
    } catch (e) {
      console.error('Failed to send recovery alert:', e)
      return false
    }
  }

  return { init, sendDownAlert, sendRecoveryAlert }
})()
