import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { money } from '../util.js'

const empty = { sku: '', name: '', category: '', cost: '', price: '', reorderLevel: '' }

export default function Products() {
  const { state, dispatch, stockOf } = useStore()
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [adj, setAdj] = useState(null) // { productId, qty, note }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    const product = { ...form, cost: +form.cost, price: +form.price, reorderLevel: +form.reorderLevel }
    if (editing) dispatch({ type: 'updateProduct', product: { ...product, id: editing } })
    else dispatch({ type: 'addProduct', product })
    setForm(empty)
    setEditing(null)
  }
  const edit = (p) => {
    setEditing(p.id)
    setForm({ sku: p.sku, name: p.name, category: p.category, cost: p.cost, price: p.price, reorderLevel: p.reorderLevel })
  }
  const list = state.products.filter((p) => (p.name + p.sku + p.category).toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <h2>{editing ? 'Edit product' : 'Add product'}</h2>
      <form className="form" onSubmit={submit}>
        <input required placeholder="SKU" value={form.sku} onChange={set('sku')} />
        <input required placeholder="Name" value={form.name} onChange={set('name')} />
        <input placeholder="Category" value={form.category} onChange={set('category')} />
        <input required type="number" min="0" step="0.01" placeholder="Cost" value={form.cost} onChange={set('cost')} />
        <input required type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={set('price')} />
        <input required type="number" min="0" placeholder="Reorder level" value={form.reorderLevel} onChange={set('reorderLevel')} />
        <button type="submit">{editing ? 'Save' : 'Add'}</button>
        {editing && <button type="button" className="ghost" onClick={() => { setEditing(null); setForm(empty) }}>Cancel</button>}
      </form>

      <h2>Products</h2>
      <input className="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      <table>
        <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Cost</th><th>Price</th><th>Stock</th><th></th></tr></thead>
        <tbody>
          {list.map((p) => {
            const stock = stockOf(p.id)
            return (
              <tr key={p.id}>
                <td>{p.sku}</td><td>{p.name}</td><td>{p.category}</td><td>{money(p.cost)}</td><td>{money(p.price)}</td>
                <td><span className={'badge ' + (stock <= p.reorderLevel ? 'warn' : 'ok')}>{stock}</span></td>
                <td className="actions">
                  <button className="ghost" onClick={() => setAdj({ productId: p.id, qty: '', note: '' })}>Adjust</button>
                  <button className="ghost" onClick={() => edit(p)}>Edit</button>
                  <button className="danger" onClick={() => confirm(`Delete ${p.name} and its history?`) && dispatch({ type: 'deleteProduct', id: p.id })}>Delete</button>
                </td>
              </tr>
            )
          })}
          {list.length === 0 && <tr><td colSpan="7" className="muted">No products found.</td></tr>}
        </tbody>
      </table>

      {adj && (
        <form className="form modal" onSubmit={(e) => {
          e.preventDefault()
          if (+adj.qty) dispatch({ type: 'adjust', productId: adj.productId, qty: +adj.qty, note: adj.note })
          setAdj(null)
        }}>
          <strong>Stock adjustment: {state.products.find((p) => p.id === adj.productId)?.name}</strong>
          <input required type="number" placeholder="+/- quantity (e.g. -3 for damaged)" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value })} />
          <input placeholder="Reason" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
          <button type="submit">Apply</button>
          <button type="button" className="ghost" onClick={() => setAdj(null)}>Cancel</button>
        </form>
      )}
    </>
  )
}
