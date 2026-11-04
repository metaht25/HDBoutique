import { dateText, money } from './api'
import type { SalesPoint } from './contracts'
import styles from './Boutique.module.css'

export function SalesChart({ points, metric }: { points: SalesPoint[]; metric: 'amount' | 'count' }) {
  const title = metric === 'amount' ? 'Evolución de ventas' : 'Cantidad de ventas'
  const values = points.map(point => metric === 'amount' ? BigInt(point.amount.replace('.', '')) : BigInt(point.count))
  const max = values.reduce((highest, value) => value > highest ? value : highest, 0n)
  if (!max) return <p className={styles.empty}>No hay ventas confirmadas para este período.</p>
  const width = 680, height = 220, step = 620 / Math.max(points.length, 1)
  return <figure className={styles.chart}>
    <p className={styles.hint}>Máximo diario: {metric === 'amount' ? money(points[values.findIndex(value => value === max)]!.amount) : String(max)}</p>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <title>{title}</title><desc>Ventas confirmadas por día, en America/Managua. Los valores completos están en la tabla desplegable.</desc>
      <line x1="40" x2="665" y1="185" y2="185" stroke="currentColor" />
      {points.map((point, index) => {
        const size = Number(values[index]! * 15000n / max) / 100, x = 44 + index * step
        return <g key={point.date}><rect x={x} y={185 - size} width={Math.max(2, step - 5)} height={size} rx="2" fill="var(--accent, #c72b7c)"><title>{dateText(point.date)}: {metric === 'amount' ? money(point.amount) : point.count}</title></rect></g>
      })}
    </svg>
    <figcaption className={styles.hint} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{dateText(points[0]!.date)}</span><span>{dateText(points[points.length - 1]!.date)}</span></figcaption>
    <details><summary>Ver valores de {title.toLocaleLowerCase()}</summary><table><thead><tr><th>Fecha</th><th>{metric === 'amount' ? 'Ingresos' : 'Ventas'}</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{dateText(point.date)}</td><td>{metric === 'amount' ? money(point.amount) : point.count}</td></tr>)}</tbody></table></details>
  </figure>
}
