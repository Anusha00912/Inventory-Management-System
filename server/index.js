import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { api } from './api.js'
import * as db from './db.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prod = process.argv.includes('--prod') || process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 3000

await db.init()
const app = express()
app.use(express.json())
app.use('/api', api)

if (prod) {
  const dist = path.join(root, 'dist')
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
} else {
  // Dev: run Vite inside this same server (hot reload, no second process).
  const { createServer } = await import('vite')
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

app.listen(port, () => {
  console.log(`Inventory app (${prod ? 'production' : 'dev'}) on http://localhost:${port}`)
})
