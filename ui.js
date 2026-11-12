import { el, changeTone, formatChange, formatCompact, formatNumber, formatPercent, formatPrice } from './utils.js';
import { isWatched } from './watchlist.js';

export const byId = (id) => document.getElementById(id);

const stripHtml = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();

export const renderHeader = (summary, currency) => {
  byId('stat-market-cap').textContent = formatCompact(summary?.total_market_cap?.[currency], currency);
  byId('stat-volume').textContent = formatCompact(summary?.total_volume?.[currency], currency);
  byId('stat-dominance').textContent = formatPercent(summary?.market_cap_percentage?.btc);
  byId('stat-active').textContent = formatNumber(summary?.active_cryptocurrencies, currency);

  const change = summary?.market_cap_change_percentage_24h_usd;
  const status = byId('market-status');
  status.textContent = change == null ? 'Live market data' : `Global market 24h ${formatChange(change)}`;
  status.className = `status-pill ${changeTone(change)}`;
};

export const renderUpdated = () => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  byId('last-updated').textContent = `· Updated ${time}`;
};

const coinLink = (coin) =>
  el('button', {
    className: 'coin-link',
    attrs: { type: 'button', 'data-action': 'details', 'data-coin-id': coin.id },
    children: [
      el('img', {
        className: 'coin-logo',
        attrs: { src: coin.image ?? coin.thumb, alt: '', width: 32, height: 32, loading: 'lazy' },
      }),
      el('span', {
        className: 'coin-meta',
        children: [
          el('strong', { className: 'coin-name', text: coin.name }),
          el('small', { className: 'coin-symbol', text: coin.symbol.toUpperCase() }),
        ],
      }),
    ],
  });

const starButton = (coin) => {
  const watched = isWatched(coin.id);
  return el('button', {
    className: watched ? 'star is-on' : 'star',
    text: watched ? '★' : '☆',
    attrs: {
      type: 'button',
      'data-action': 'toggle-watch',
      'data-coin-id': coin.id,
      'aria-pressed': String(watched),
      'aria-label': `${watched ? 'Remove' : 'Add'} ${coin.name} ${watched ? 'from' : 'to'} watchlist`,
    },
  });
};

const coinRow = (coin, currency) => {
  const change = coin.price_change_percentage_24h;
  return el('tr', {
    children: [
      el('td', { text: String(coin.market_cap_rank ?? '—') }),
      el('td', { children: [coinLink(coin)] }),
      el('td', { className: 'num', text: formatPrice(coin.current_price, currency) }),
      el('td', { className: `num ${changeTone(change)}`, text: formatChange(change) }),
      el('td', { className: 'num col-cap', text: formatCompact(coin.market_cap, currency) }),
      el('td', { children: [starButton(coin)] }),
    ],
  });
};

export const renderRows = (coins, currency) =>
  byId('coin-rows').replaceChildren(...coins.map((coin) => coinRow(coin, currency)));

export const renderSkeleton = (rows = 6) =>
  byId('coin-rows').replaceChildren(
    ...Array.from({ length: rows }, () =>
      el('tr', {
        children: Array.from({ length: 6 }, () => el('td', { children: [el('span', { className: 'skeleton-bar' })] })),
      }),
    ),
  );

export const showState = (container, { title, message, action, actionLabel }) => {
  const children = [el('h3', { text: title }), el('p', { text: message })];
  if (action) {
    children.push(
      el('button', { className: 'btn btn-primary', text: actionLabel, attrs: { type: 'button', 'data-action': action } }),
    );
  }
  container.replaceChildren(el('div', { className: 'state-box', children }));
  container.hidden = false;
};

export const clearState = (container) => {
  container.replaceChildren();
  container.hidden = true;
};

export const renderSearchResults = (query, coins) => {
  const panel = byId('search-panel');
  if (!coins.length) {
    showState(panel, {
      title: 'No results found',
      message: `Nothing matched “${query}”. Try another name or symbol.`,
      action: 'clear-search',
      actionLabel: 'Clear search',
    });
    return;
  }
  panel.replaceChildren(
    el('h2', { className: 'panel-title', text: `Results for “${query}”` }),
    el('ul', {
      className: 'result-list',
      children: coins.map((coin) => el('li', { className: 'result-item', children: [coinLink(coin), starButton(coin)] })),
    }),
  );
  panel.hidden = false;
};

export const renderDetail = (coin, currency) => {
  const market = coin.market_data ?? {};
  const local = (key) => market[key]?.[currency];
  const change = market.price_change_percentage_24h;
  const supply = (value) => formatNumber(value, currency, { notation: 'compact', maximumFractionDigits: 2 });
  const details = [
    ['Market cap', formatCompact(local('market_cap'), currency)],
    ['Trading volume (24h)', formatCompact(local('total_volume'), currency)],
    ['Circulating supply', supply(market.circulating_supply)],
    ['Total supply', supply(market.total_supply)],
    ['Max supply', market.max_supply ? supply(market.max_supply) : 'Not available'],
    ['All-time high', formatPrice(local('ath'), currency)],
    ['All-time low', formatPrice(local('atl'), currency)],
  ];
  const website = coin.links?.homepage?.find(Boolean);
  const description = stripHtml(coin.description?.en ?? '') || 'No description available.';

  byId('detail-content').replaceChildren(
    el('div', {
      className: 'detail-head',
      children: [
        el('img', { className: 'detail-logo', attrs: { src: coin.image?.large, alt: '', width: 56, height: 56 } }),
        el('div', {
          children: [
            el('h2', { text: coin.name, attrs: { id: 'detail-title' } }),
            el('p', { className: 'coin-symbol', text: coin.symbol.toUpperCase() }),
          ],
        }),
      ],
    }),
    el('p', {
      className: 'detail-price',
      children: [
        el('strong', { text: formatPrice(local('current_price'), currency) }),
        el('span', { className: changeTone(change), text: formatChange(change) }),
      ],
    }),
    el('dl', {
      className: 'detail-grid',
      children: details.map(([label, value]) =>
        el('div', { children: [el('dt', { text: label }), el('dd', { text: value })] }),
      ),
    }),
    el('p', { className: 'detail-desc', text: description }),
    ...(website
      ? [el('a', { className: 'btn btn-ghost', text: 'Official website', attrs: { href: website, target: '_blank', rel: 'noopener noreferrer' } })]
      : []),
  );
};
