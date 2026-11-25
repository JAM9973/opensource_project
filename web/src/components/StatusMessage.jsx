const TITLES = { loading: '불러오는 중', empty: '데이터 없음', error: '오류' }

/** 로딩·데이터 없음·오류 공통 표시. kind: 'loading' | 'empty' | 'error' */
export default function StatusMessage({ kind = 'empty', title, children }) {
  return (
    <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <span className="spinner" aria-hidden="true" />}
      <div>
        <strong>{title ?? TITLES[kind]}</strong>
        {children && <p>{children}</p>}
      </div>
    </div>
  )
}
