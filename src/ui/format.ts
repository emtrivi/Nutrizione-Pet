// Numeri in formato italiano: virgola per i decimali, punto per le migliaia.

export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int = '0', dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return sign + (dec ? `${grouped},${dec}` : grouped);
}
