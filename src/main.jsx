import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/ads/ads-wall.css'
// Va DESPUES de index.css: sus reglas moviles pisan a las de escritorio de igual especificidad.
import './styles/profile-mobile.css'
// Chats de la intranet y titulo del pedido en movil; tambien despues de index.css.
import './styles/chat-mobile.css'
// Chat del pedido (comprador <-> tienda) y su bandeja, clonados de la app; despues de chat-mobile.css.
import './styles/mediation-chat.css'
// Web publica en movil (auditoria 2026-09-26); va al final para ganar la cascada.
import './styles/public-mobile.css'
// Ficha del repuesto en movil clonada de la app (2026-09-29); despues de public-mobile.css.
import './styles/product-detail-mobile.css'
// Ficha del repuesto en escritorio (≥769px): todo dentro de min-width, no toca el móvil.
import './styles/product-detail-desktop.css'
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
