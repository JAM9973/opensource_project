import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

/** Chart.js 공통 래퍼. config가 바뀌면 차트를 다시 만든다. */
export default function ChartCanvas({ type, data, options, label, height = 260 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const chart = new Chart(canvasRef.current, {
      type,
      data,
      options: { responsive: true, maintainAspectRatio: false, ...options },
    })
    return () => chart.destroy()
  }, [type, data, options])

  return (
    <div className="chart-box" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  )
}
