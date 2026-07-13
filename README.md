# LTork Controls — API Health Monitoring Dashboard

Real-time API health monitoring for LTork Controls Stage and Live APIs.

## Features

- Monitors both Stage and Live API health endpoints every 3 minutes
- Response time tracking with sparkline charts
- Uptime percentage calculation
- Email alerts via EmailJS (Online → Offline, Offline → Online)
- Browser notifications
- Toast notifications
- Dark/Light theme toggle
- Export health history as JSON
- LocalStorage persistence (last 20 checks)
- Fully responsive (desktop, tablet, mobile)
- No backend required — deploy directly to Vercel

## APIs Monitored

| Environment | URL |
|-------------|-----|
| Stage | `https://stage.api.ltorkcontrols.com/health` |
| Live | `https://api.ltorkcontrols.com/health` |

## Setup

1. Clone the repository
2. Open `js/email.js` and replace `YOUR_DOWN_TEMPLATE_ID` / `YOUR_RECOVERY_TEMPLATE_ID` with your EmailJS template IDs
3. Deploy to Vercel

## EmailJS Templates

Create two email templates in your EmailJS dashboard:

### Down Alert Template
- Subject: `🚨 LTork Controls API Down`
- Variables: `{{environment}}`, `{{status}}`, `{{url}}`, `{{time}}`, `{{reason}}`

### Recovery Alert Template
- Subject: `✅ LTork Controls API Restored`
- Variables: `{{environment}}`, `{{status}}`, `{{url}}`, `{{time}}`

## Tech Stack

- HTML5, CSS3, JavaScript (ES6)
- Canvas API for sparkline charts
- EmailJS for email notifications
- LocalStorage for data persistence

## Version

v1.0.0
