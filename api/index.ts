import { createApp } from '../src/server/app.js'
import { loadConfig } from '../src/server/config.js'

// Vercel serves the client from its CDN; this function only handles /api/*.
export default createApp(loadConfig())
