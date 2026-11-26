import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AnalysisProvider } from './context/AnalysisContext.jsx'
import { AnalysisJobProvider } from './features/new-analysis/AnalysisJobContext.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalysisProvider>
      <AnalysisJobProvider>
        <App />
      </AnalysisJobProvider>
    </AnalysisProvider>
  </StrictMode>,
)
