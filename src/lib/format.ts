/** Formatting helpers shared by every screen. Mirrors the web client's `lib/utils`. */

export const EM_DASH = '—';

/** `YYYY-MM-DD` in *local* time — never `toISOString`, which shifts the day. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const today = () => toISODate(new Date());

/** "03 Aug 26" */
export function formatDate(value?: string | Date | null): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

/** "03 Aug 26, 02:30 pm" — matches the web Created/Updated columns. */
export function formatDateTime(value?: string | Date | null): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2 hours ago" — used where recency matters more than the exact stamp. */
export function formatRelative(value?: string | Date | null): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2592000],
    ['year', 31536000],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) if (seconds >= unit[1]) chosen = unit;
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

/** Indian digit grouping, no currency symbol. */
export function formatNumber(value?: number | string | null, fractionDigits = 0): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const num = Number(value);
  if (Number.isNaN(num)) return EM_DASH;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCurrency(value?: number | null, fractionDigits = 2): string {
  if (value === null || value === undefined) return EM_DASH;
  const num = Number(value);
  if (Number.isNaN(num)) return EM_DASH;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Compact weights: 1,240 kg → "1.24 t" once past a tonne. */
export function formatWeight(kg?: number | null): string {
  if (kg === null || kg === undefined || Number.isNaN(Number(kg))) return EM_DASH;
  const value = Number(kg);
  if (Math.abs(value) >= 1000) return `${formatNumber(value / 1000, 2)} t`;
  return `${formatNumber(value, 2)} kg`;
}

/** Two-letter avatar initials. */
export function initialsOf(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** `snake_case` / `kebab-case` → "Title Case", for audit-log field names. */
export function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Mongo populate returns either an id string or the whole document. Both shapes
 * reach the UI, so every read of a reference goes through these two helpers.
 */
export function refId(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && '_id' in (ref as Record<string, unknown>)) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

export function refLabel(ref: unknown, ...fields: string[]): string {
  if (!ref) return EM_DASH;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object') {
    const record = ref as Record<string, unknown>;
    for (const field of fields) {
      if (record[field]) return String(record[field]);
    }
  }
  return EM_DASH;
}
