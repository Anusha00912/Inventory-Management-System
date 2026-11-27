import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { money, fmtDate } from '../util.js'

const blank = { productId: '', qty: '', unitCost: '', supplier: '' }

export default function Purchases() {
  const { state, dispatch } = useStore()
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const name = (id) => state.products.find((p) => p.id === id)?.name ?? '(deleted)'

  const pick = (e) => {
    const p = state.products.find((x) => x.id === e.target.value)
    setF({ ...f, productId: e.target.value, unitCost: p ? p.cost : '' })
  }
  const submit = (e) => {
    e.preventDefault()
    dispatch({ type: 'addPurchase', purchase: { ...f, qty: +f.qty, unitCost: +f.unitCost } })
    setF(blank)
  }
  return (
    <>
      <h2>Record purchase</h2>
      <form className="form" onSubmit={submit}>
        <select required value={f.productId} onChange={pick}>
          <option value="">Select product…</option>
          {state.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input required type="number" min="1" placeholder="Quantity" value={f.qty} onChange={set('qty')} />
        <input required type="number" min="0" step="0.01" placeholder="Unit cost" value={f.unitCost} onChange={set('unitCost')} />
        <input placeholder="Supplier" value={f.supplier} onChange={set('supplier')} />
        <button type="submit">Add purchase</button>
      </form>
      <h2>Purchase history</h2>
      <table>
        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Unit cost</th><th>Total</th><th>Supplier</th></tr></thead>
        <tbody>{state.purchases.map((p) => (
          <tr key={p.id}><td>{fmtDate(p.date)}</td><td>{name(p.productId)}</td><td>{p.qty}</td><td>{money(p.unitCost)}</td><td>{money(p.qty * p.unitCost)}</td><td>{p.supplier}</td></tr>
        ))}</tbody>
      </table>
    </>
  )
}
