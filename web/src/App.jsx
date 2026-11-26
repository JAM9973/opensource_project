import { Suspense, useEffect, useState } from 'react'
import AnalysisSelector from './components/AnalysisSelector.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import StatusMessage from './components/StatusMessage.jsx'
import { useAnalysis } from './context/AnalysisContext.jsx'
import { pages } from './pages.jsx'

function pageFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '')
  return pages.some((p) => p.id === id) ? id : pages[0].id
}

export default function App() {
  const { pageProps } = useAnalysis()
  const [pageId, setPageId] = useState(pageFromHash)

  useEffect(() => {
    const onHash = () => setPageId(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (id) => {
    window.location.hash = `/${id}`
    setPageId(id)
  }

  const page = pages.find((p) => p.id === pageId) ?? pages[0]
  const { Component } = page

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>식당 테이블 영상 분석</h1>
          <p>시간은 영상 재생시간 기준입니다.</p>
        </div>
        <AnalysisSelector />
      </header>

      <nav className="tabs" aria-label="화면 전환">
        {pages.map((p) => (
          <button key={p.id} type="button" className={p.id === page.id ? 'tab active' : 'tab'} aria-current={p.id === page.id ? 'page' : undefined} onClick={() => go(p.id)}>
            {p.label}
          </button>
        ))}
      </nav>

      <main className="page">
        <ErrorBoundary resetKey={`${page.id}:${pageProps.analysisId}`}>
          <Suspense fallback={<StatusMessage kind="loading">화면을 불러오는 중입니다.</StatusMessage>}>
            <Component {...pageProps} onNavigate={go} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
