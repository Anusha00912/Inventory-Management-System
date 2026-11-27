const day = (n) => new Date(Date.now() - n * 86400000).toISOString()

const products = [
  { id: 'p1', sku: 'KB-001', name: 'Mechanical Keyboard', category: 'Peripherals', cost: 45, price: 89, reorderLevel: 10 },
  { id: 'p2', sku: 'MS-002', name: 'Wireless Mouse', category: 'Peripherals', cost: 12, price: 29, reorderLevel: 15 },
  { id: 'p3', sku: 'MN-003', name: '27-inch Monitor', category: 'Displays', cost: 160, price: 249, reorderLevel: 5 },
  { id: 'p4', sku: 'CB-004', name: 'USB-C Cable 2m', category: 'Accessories', cost: 2, price: 9, reorderLevel: 30 },
  { id: 'p5', sku: 'HS-005', name: 'Noise-Cancelling Headset', category: 'Audio', cost: 70, price: 139, reorderLevel: 8 },
]

const purchases = [
  { id: 'pu1', productId: 'p1', qty: 40, unitCost: 45, supplier: 'KeyCo', date: day(30) },
  { id: 'pu2', productId: 'p2', qty: 60, unitCost: 12, supplier: 'MouseWorld', date: day(30) },
  { id: 'pu3', productId: 'p3', qty: 12, unitCost: 160, supplier: 'ViewTech', date: day(28) },
  { id: 'pu4', productId: 'p4', qty: 100, unitCost: 2, supplier: 'CablesRUs', date: day(25) },
  { id: 'pu5', productId: 'p5', qty: 20, unitCost: 70, supplier: 'SoundHub', date: day(20) },
]

const sales = [
  { id: 's1', productId: 'p1', qty: 32, unitPrice: 89, customer: 'Acme Corp', date: day(14) },
  { id: 's2', productId: 'p2', qty: 48, unitPrice: 29, customer: 'Globex', date: day(10) },
  { id: 's3', productId: 'p3', qty: 8, unitPrice: 249, customer: 'Initech', date: day(7) },
  { id: 's4', productId: 'p4', qty: 75, unitPrice: 9, customer: 'Walk-in', date: day(3) },
  { id: 's5', productId: 'p5', qty: 4, unitPrice: 139, customer: 'Umbrella', date: day(1) },
]

// Movements are the source of truth for stock. qty is signed (+in / -out).
const movements = [
  ...purchases.map((p) => ({ id: 'm-' + p.id, productId: p.productId, type: 'purchase', qty: p.qty, note: `Purchase from ${p.supplier}`, date: p.date, ref: p.id })),
  ...sales.map((s) => ({ id: 'm-' + s.id, productId: s.productId, type: 'sale', qty: -s.qty, note: `Sale to ${s.customer}`, date: s.date, ref: s.id })),
]

export const seed = { products, purchases, sales, movements }
