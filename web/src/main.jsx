import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AnalysisProvider } from './context/AnalysisContext.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalysisProvider>
      <App />
    </AnalysisProvider>
  </StrictMode>,
)
