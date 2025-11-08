export function fmtBytes(value?: number | null) {
  if (value === null || value === undefined) return '—';
  if (!Number.isFinite(Number(value))) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let bytes = Math.abs(Number(value));
  let unitIndex = 0;
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024;
    unitIndex += 1;
  }
  const decimals = bytes >= 10 || unitIndex === 0 ? 0 : 1;
  const formatted = bytes.toFixed(decimals);
  const prefix = Number(value) < 0 ? '-' : '';
  return `${prefix}${formatted} ${units[unitIndex]}`;
}
