import { useLayoutEffect, useRef, useState } from 'react'

// Single-series charts in the portfolio accent. Every chart has a hover
// tooltip and a table view, so values never depend on colour alone.

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(600)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

const niceMax = (v) => {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => v / s <= 4) ?? pow * 10
  return Math.ceil(v / step) * step
}

function ChartFrame({ title, sub, rows, valueLabel, children }) {
  const [table, setTable] = useState(false)
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        <button type="button" className="link-btn" onClick={() => setTable(!table)} aria-pressed={table}>{table ? 'Chart' : 'Table'}</button>
      </figcaption>
      {table ? (
        <div className="table-wrap chart-table">
          <table>
            <thead><tr><th>Item</th><th className="num">{valueLabel}</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td className="num">{r.value}</td></tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </figure>
  )
}

function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      <span>{tip.label}</span>
      <strong>{tip.value}</strong>
    </div>
  )
}

/** Vertical columns: counts over time. */
export function ColumnChart({ title, sub, data, valueLabel = 'Count', tone = 'accent', height = 190 }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  const pad = { l: 30, r: 8, t: 12, b: 26 }
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)))
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const band = innerW / Math.max(1, data.length)
  const barW = Math.min(24, Math.max(4, band - 4))
  const y = (v) => pad.t + innerH - (v / max) * innerH
  const ticks = [0, max / 2, max]
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 54)))
  return (
    <ChartFrame title={title} sub={sub} rows={data} valueLabel={valueLabel}>
      <div className="chart-plot" ref={ref} onPointerLeave={() => setTip(null)}>
        <svg width={width} height={height} role="img" aria-label={`${title}: column chart`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
              <text x={pad.l - 6} y={y(t) + 4} className="axis" textAnchor="end">{t}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + i * band + (band - barW) / 2
            const h = Math.max(d.value > 0 ? 2 : 0, innerH - (y(d.value) - pad.t))
            const r = Math.min(4, h)
            return (
              <g key={d.label}>
                {h > 0 && (
                  <path className={`mark mark-${tone}`} d={`M${x},${pad.t + innerH} V${pad.t + innerH - h + r} Q${x},${pad.t + innerH - h} ${x + r},${pad.t + innerH - h} H${x + barW - r} Q${x + barW},${pad.t + innerH - h} ${x + barW},${pad.t + innerH - h + r} V${pad.t + innerH} Z`} />
                )}
                <rect x={pad.l + i * band} y={pad.t} width={band} height={innerH} fill="transparent"
                  onPointerEnter={() => setTip({ x: x + barW / 2, y: y(d.value) - 8, label: d.label, value: `${d.value} ${valueLabel.toLowerCase()}` })} />
                {i % labelEvery === 0 && <text x={x + barW / 2} y={height - 8} className="axis" textAnchor="middle">{d.short ?? d.label}</text>}
              </g>
            )
          })}
        </svg>
        <Tooltip tip={tip} />
      </div>
    </ChartFrame>
  )
}

/** Horizontal bars: ranked lists (most borrowed, most active, categories). */
export function BarList({ title, sub, data, valueLabel = 'Count', tone = 'accent' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ChartFrame title={title} sub={sub} rows={data} valueLabel={valueLabel}>
      <ol className="barlist">
        {data.map((d) => (
          <li key={d.label} title={`${d.label}: ${d.value}`}>
            <span className="barlist-label">{d.label}</span>
            <span className="barlist-track"><span className={`barlist-bar mark-${tone}`} style={{ width: `${(d.value / max) * 100}%` }} /></span>
            <span className="barlist-value">{d.value}</span>
          </li>
        ))}
      </ol>
    </ChartFrame>
  )
}

/** Line with a soft area wash and crosshair tooltip: trends over time. */
export function LineChart({ title, sub, data, valueLabel = 'Count', tone = 'accent', height = 190 }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const pad = { l: 30, r: 14, t: 12, b: 26 }
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)))
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const x = (i) => pad.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v) => pad.t + innerH - (v / max) * innerH
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${pad.t + innerH} L${x(0)},${pad.t + innerH} Z`
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 54)))
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - pad.l) / innerW) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }
  const last = data.length - 1
  return (
    <ChartFrame title={title} sub={sub} rows={data} valueLabel={valueLabel}>
      <div className="chart-plot" ref={ref}>
        <svg width={width} height={height} role="img" aria-label={`${title}: line chart`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
              <text x={pad.l - 6} y={y(t) + 4} className="axis" textAnchor="end">{t}</text>
            </g>
          ))}
          <path d={area} className={`area area-${tone}`} />
          <path d={line} className={`line line-${tone}`} />
          {data.map((d, i) => i % labelEvery === 0 && <text key={d.label} x={x(i)} y={height - 8} className="axis" textAnchor="middle">{d.short ?? d.label}</text>)}
          <circle cx={x(last)} cy={y(data[last]?.value ?? 0)} r="4" className={`dot dot-${tone}`} />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} className="crosshair" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r="5" className={`dot dot-${tone}`} />
            </g>
          )}
        </svg>
        <Tooltip tip={hover != null ? { x: x(hover), y: y(data[hover].value) - 10, label: data[hover].label, value: `${data[hover].value} ${valueLabel.toLowerCase()}` } : null} />
      </div>
    </ChartFrame>
  )
}
