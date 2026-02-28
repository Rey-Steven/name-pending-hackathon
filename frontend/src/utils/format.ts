export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('el-GR')
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('el-GR')
}
