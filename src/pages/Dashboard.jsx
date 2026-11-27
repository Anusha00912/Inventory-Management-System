import React from 'react'
import { useStore } from '../store.jsx'
import { money } from '../util.js'

export default function Dashboard() {
  const { state, stockOf } = useStore()
  const rows = state.products.map((p) => ({ ...p, stock: stockOf(p.id) }))
  const low = rows.filter((p) => p.stock <= p.reorderLevel)
  const stockValue = rows.reduce((n, p) => n + p.stock * p.cost, 0)
  const revenue = state.sales.reduce((n, s) => n + s.qty * s.unitPrice, 0)
  const spend = state.purchases.reduce((n, p) => n + p.qty * p.unitCost, 0)
  const cards = [
    ['Products', state.products.length],
    ['Stock value (at cost)', money(stockValue)],
    ['Total sales', money(revenue)],
    ['Total purchases', money(spend)],
    ['Low-stock items', low.length],
  ]
  return (
    <>
      <div className="cards">
        {cards.map(([l, v]) => (
          <div className="card" key={l}><div className="label">{l}</div><div className="value">{v}</div></div>
        ))}
      </div>
      <h2>Low stock alerts</h2>
      {low.length === 0 ? <p className="muted">Everything is well stocked.</p> : (
        <table>
          <thead><tr><th>SKU</th><th>Product</th><th>In stock</th><th>Reorder level</th></tr></thead>
          <tbody>{low.map((p) => (
            <tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td><span className="badge warn">{p.stock}</span></td><td>{p.reorderLevel}</td></tr>
          ))}</tbody>
        </table>
      )}
    </>
  )
}
