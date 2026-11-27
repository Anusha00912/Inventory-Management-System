export const money = (n) => Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
export const fmtDate = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
