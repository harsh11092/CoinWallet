const LOCALES = { usd: 'en-US', inr: 'en-IN' };

export const formatPrice = (value, currency) => {
  if (value == null) return '—';
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
};

export const formatCompact = (value, currency) => {
  if (value == null) return '—';
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatNumber = (value, currency, options = {}) =>
  value == null ? '—' : new Intl.NumberFormat(LOCALES[currency], options).format(value);

export const formatPercent = (value) =>
  value == null
    ? '—'
    : `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;

export const formatChange = (value) => {
  if (value == null) return '—';
  const arrow = value > 0 ? '▲ ' : value < 0 ? '▼ ' : '';
  return `${arrow}${formatPercent(Math.abs(value))}`;
};

export const changeTone = (value) => (value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-flat');

const SORT_FIELDS = {
  rank: 'market_cap_rank',
  price: 'current_price',
  change: 'price_change_percentage_24h',
  marketCap: 'market_cap',
};

export const sortCoins = (coins, sortValue) => {
  const [field, direction] = sortValue.split(':');
  const key = SORT_FIELDS[field];
  const order = direction === 'desc' ? -1 : 1;
  return [...coins].sort((a, b) => {
    const aVal = a[key] ?? 0;
    const bVal = b[key] ?? 0;
    return (aVal - bVal) * order;
  });
};

export const debounce = (callback, delay = 400) => {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => callback(...args), delay);
  };
};

export const el = (tag, { className, text, attrs = {}, children = [] } = {}) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
  node.append(...children);
  return node;
};

export const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};
