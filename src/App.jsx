import React, { useState } from 'react'
import { useStore } from './store.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Products from './pages/Products.jsx'
import Purchases from './pages/Purchases.jsx'
import Sales from './pages/Sales.jsx'
import Movements from './pages/Movements.jsx'

const TABS = [
  ['Dashboard', Dashboard],
  ['Products', Products],
  ['Purchases', Purchases],
  ['Sales', Sales],
  ['Movements', Movements],
]

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const { dispatch, error, clearError } = useStore()
  const Page = TABS.find(([n]) => n === tab)[1]
  return (
    <div className="app">
      <header>
        <h1>📦 Inventory Manager</h1>
        <nav>
          {TABS.map(([n]) => (
            <button key={n} className={n === tab ? 'active' : ''} onClick={() => setTab(n)}>{n}</button>
          ))}
        </nav>
        <button className="ghost" onClick={() => confirm('Reset all data to sample data?') && dispatch({ type: 'reset' })}>
          Reset demo data
        </button>
      </header>
      {error && <div className="banner" onClick={clearError}>{error} (click to dismiss)</div>}
      <main><Page /></main>
    </div>
  )
}
