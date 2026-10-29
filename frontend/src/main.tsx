import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './app/App'
import { SessionProvider } from './features/session/SessionProvider'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Application root not found')
createRoot(root).render(<StrictMode><BrowserRouter><SessionProvider>
  <App />
</SessionProvider></BrowserRouter></StrictMode>)
