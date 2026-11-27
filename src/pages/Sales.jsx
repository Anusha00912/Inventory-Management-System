import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { money, fmtDate } from '../util.js'

const blank = { productId: '', qty: '', unitPrice: '', customer: '' }

export default function Sales() {
  const { state, dispatch, stockOf } = useStore()
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const name = (id) => state.products.find((p) => p.id === id)?.name ?? '(deleted)'

  const pick = (e) => {
    const p = state.products.find((x) => x.id === e.target.value)
    setF({ ...f, productId: e.target.value, unitPrice: p ? p.price : '' })
  }
  const submit = async (e) => {
    e.preventDefault()
    const avail = stockOf(f.productId)
    if (+f.qty > avail) return setError(`Only ${avail} in stock.`)
    const r = await dispatch({ type: 'addSale', sale: { ...f, qty: +f.qty, unitPrice: +f.unitPrice } })
    if (r.ok) {
      setError('')
      setF(blank)
    } else setError(r.error)
  }
  return (
    <>
      <h2>Record sale</h2>
      <form className="form" onSubmit={submit}>
        <select required value={f.productId} onChange={pick}>
          <option value="">Select product…</option>
          {state.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({stockOf(p.id)} in stock)</option>)}
        </select>
        <input required type="number" min="1" placeholder="Quantity" value={f.qty} onChange={set('qty')} />
        <input required type="number" min="0" step="0.01" placeholder="Unit price" value={f.unitPrice} onChange={set('unitPrice')} />
        <input placeholder="Customer" value={f.customer} onChange={set('customer')} />
        <button type="submit">Add sale</button>
      </form>
      {error && <p className="error">{error}</p>}
      <h2>Sales history</h2>
      <table>
        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th><th>Customer</th></tr></thead>
        <tbody>{state.sales.map((s) => (
          <tr key={s.id}><td>{fmtDate(s.date)}</td><td>{name(s.productId)}</td><td>{s.qty}</td><td>{money(s.unitPrice)}</td><td>{money(s.qty * s.unitPrice)}</td><td>{s.customer}</td></tr>
        ))}</tbody>
      </table>
    </>
  )
}
