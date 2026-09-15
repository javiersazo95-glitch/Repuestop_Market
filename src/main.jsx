import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/ads/ads-wall.css'
import App from './App.jsx'
import { initSentry } from './sentry.js'
import { watchStaleChunks } from './utils/staleDeploy.js'

initSentry()
watchStaleChunks()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
