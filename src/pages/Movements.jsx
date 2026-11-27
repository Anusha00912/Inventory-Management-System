import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { fmtDate } from '../util.js'

export default function Movements() {
  const { state } = useStore()
  const [type, setType] = useState('all')
  const [pid, setPid] = useState('all')
  const name = (id) => state.products.find((p) => p.id === id)?.name ?? '(deleted)'
  const list = state.movements
    .filter((m) => (type === 'all' || m.type === type) && (pid === 'all' || m.productId === pid))
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <h2>Inventory movements</h2>
      <div className="form">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          <option value="purchase">Purchases</option>
          <option value="sale">Sales</option>
          <option value="adjustment">Adjustments</option>
        </select>
        <select value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="all">All products</option>
          {state.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Note</th></tr></thead>
        <tbody>{list.map((m) => (
          <tr key={m.id}>
            <td>{fmtDate(m.date)}</td><td>{name(m.productId)}</td><td><span className={'badge ' + m.type}>{m.type}</span></td>
            <td className={m.qty > 0 ? 'pos' : 'neg'}>{m.qty > 0 ? '+' : ''}{m.qty}</td><td>{m.note}</td>
          </tr>
        ))}</tbody>
      </table>
    </>
  )
}
