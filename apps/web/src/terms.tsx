import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { terms } from './lib/legal'
import { LegalPage } from './pages/LegalPage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LegalPage doc={terms} />
  </StrictMode>,
)
