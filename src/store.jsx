import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

const StoreCtx = createContext(null)

const ROUTES = {
  addProduct: (a) => ['POST', '/api/products', a.product],
  updateProduct: (a) => ['PUT', `/api/products/${a.product.id}`, a.product],
  deleteProduct: (a) => ['DELETE', `/api/products/${a.id}`],
  addPurchase: (a) => ['POST', '/api/purchases', a.purchase],
  addSale: (a) => ['POST', '/api/sales', a.sale],
  adjust: (a) => ['POST', '/api/adjustments', { productId: a.productId, qty: a.qty, note: a.note }],
  reset: () => ['POST', '/api/reset'],
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    request('GET', '/api/state').then(setState).catch((e) => setError(e.message))
  }, [])

  // dispatch({type, ...}) calls the API and resolves to { ok, error }.
  const dispatch = useCallback(async (action) => {
    try {
      const [method, url, body] = ROUTES[action.type](action)
      setState(await request(method, url, body))
      setError('')
      return { ok: true }
    } catch (e) {
      setError(e.message)
      return { ok: false, error: e.message }
    }
  }, [])

  if (!state) return <p style={{ padding: 24 }}>{error ? `Cannot reach server: ${error}` : 'Loading…'}</p>

  const stockOf = (id) => state.movements.filter((m) => m.productId === id).reduce((n, m) => n + m.qty, 0)
  return <StoreCtx.Provider value={{ state, dispatch, stockOf, error, clearError: () => setError('') }}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)
