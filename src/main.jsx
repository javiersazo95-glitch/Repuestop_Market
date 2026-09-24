import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/ads/ads-wall.css'
import App from './App.jsx'
import { initSentry } from './sentry.js'
import { watchStaleChunks } from './utils/staleDeploy.js'
import { captureCaptadorReferralFromUrl } from './utils/captadorReferral.js'

initSentry()
watchStaleChunks()
// `?ref=CODIGO`: link que comparte un captador; precarga el codigo en el registro.
captureCaptadorReferralFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
