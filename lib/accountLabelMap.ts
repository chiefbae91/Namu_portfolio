const KEY = 'namu_account_label_map';

export function getLabelMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function setLabelMap(map: Record<string, string>) {
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new Event('account_label_map_changed'));
}

export function resolveAccountName(raw: string | undefined, map: Record<string, string>): string {
  if (!raw) return '';
  return map[raw] ?? raw;
}
