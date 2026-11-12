import { fetchMarkets, fetchGlobal, searchCoins, fetchCoinDetail, describeError } from './api.js';
import { debounce, readStorage, writeStorage, sortCoins } from './utils.js';
import { getWatchlist, isWatched, toggleWatch } from './watchlist.js';
import {
  byId,
  renderHeader,
  renderUpdated,
  renderRows,
  renderSkeleton,
  renderSearchResults,
  renderDetail,
  showState,
  clearState,
} from './ui.js';

const CURRENCY_KEY = 'coinwallet.currency';
const SUPPORTED_CURRENCIES = ['usd', 'inr'];
const DETAIL_TTL = 60000;

const FILTERS = {
  all: () => true,
  gainers: (coin) => coin.price_change_percentage_24h > 0,
  losers: (coin) => coin.price_change_percentage_24h < 0,
  watchlist: (coin) => isWatched(coin.id),
};

const EMPTY_FILTER = {
  title: 'No results found',
  message: 'No coins match this filter. Try another option or clear the filters.',
  action: 'clear-filters',
  actionLabel: 'Clear filters',
};

const EMPTY_WATCHLIST = {
  title: 'Your watchlist is empty',
  message: 'Tap the star on any coin to track it here. Your picks are saved on this device.',
  action: 'show-markets',
  actionLabel: 'Browse markets',
};

const savedCurrency = readStorage(CURRENCY_KEY, 'usd');

const state = {
  view: 'dashboard',
  currency: SUPPORTED_CURRENCIES.includes(savedCurrency) ? savedCurrency : 'usd',
  filter: 'all',
  sort: 'rank:asc',
  query: '',
  searchResults: null,
  summary: null,
  markets: { coins: [], loading: false, error: null },
  watchlist: { coins: [], loading: false, error: null },
};

const detailCache = new Map();
let searchController = null;
let marketsRequestId = 0;
let watchlistRequestId = 0;

const activeSource = () => (state.view === 'watchlist' ? state.watchlist : state.markets);

const visibleCoins = () => sortCoins(activeSource().coins.filter(FILTERS[state.filter]), state.sort);

const setRefreshing = (isRefreshing) => {
  const button = byId('refresh');
  button.disabled = isRefreshing;
  button.textContent = isRefreshing ? 'Refreshing…' : 'Refresh';
};

const renderTable = () => {
  const { coins, loading, error } = activeSource();
  const visible = visibleCoins();
  const wrap = byId('table-wrap');
  const box = byId('table-state');

  clearState(box);
  wrap.hidden = false;

  if (loading && !coins.length) {
    renderSkeleton();
  } else if (error && !coins.length) {
    wrap.hidden = true;
    showState(box, { title: 'Could not load coins', message: error, action: 'retry', actionLabel: 'Try again' });
  } else if (!visible.length) {
    wrap.hidden = true;
    showState(box, state.view === 'watchlist' && !getWatchlist().length ? EMPTY_WATCHLIST : EMPTY_FILTER);
  } else {
    renderRows(visible, state.currency);
  }

  if (error && coins.length) {
    showState(box, { title: 'Showing the last data we loaded', message: error, action: 'retry', actionLabel: 'Try again' });
  }
};

const render = () => {
  renderTable();
  if (state.searchResults && state.query.length >= 2) renderSearchResults(state.query, state.searchResults);
};

const loadMarkets = async () => {
  const requestId = ++marketsRequestId;
  Object.assign(state.markets, { loading: true, error: null });
  setRefreshing(true);
  render();

  try {
    const [coins, summary] = await Promise.all([fetchMarkets(state.currency), fetchGlobal()]);
    if (requestId !== marketsRequestId) return;
    state.markets.coins = coins;
    state.summary = summary;
    renderHeader(summary, state.currency);
    renderUpdated();
  } catch (error) {
    if (requestId === marketsRequestId) state.markets.error = describeError(error);
  } finally {
    if (requestId === marketsRequestId) {
      state.markets.loading = false;
      setRefreshing(false);
    }
    render();
  }
};

const loadWatchlist = async () => {
  const requestId = ++watchlistRequestId;
  const ids = getWatchlist();

  if (!ids.length) {
    Object.assign(state.watchlist, { coins: [], loading: false, error: null });
    render();
    return;
  }

  Object.assign(state.watchlist, { loading: true, error: null });
  render();

  try {
    const coins = await fetchMarkets(state.currency, ids);
    if (requestId === watchlistRequestId) state.watchlist.coins = coins;
  } catch (error) {
    if (requestId === watchlistRequestId) state.watchlist.error = describeError(error);
  } finally {
    if (requestId === watchlistRequestId) state.watchlist.loading = false;
    render();
  }
};

const handleToggleWatch = (coinId) => {
  const added = toggleWatch(coinId);
  state.watchlist.coins = state.watchlist.coins.filter((coin) => isWatched(coin.id));
  if (added && state.view === 'watchlist') loadWatchlist();
  render();
};

const runSearch = async (query) => {
  if (query !== state.query) return;
  searchController?.abort();
  searchController = new AbortController();
  state.searchResults = null;
  showState(byId('search-panel'), { title: 'Searching…', message: `Looking up “${query}” on CoinGecko.` });

  try {
    const coins = await searchCoins(query, searchController.signal);
    if (query !== state.query) return;
    state.searchResults = coins;
    renderSearchResults(query, coins);
  } catch (error) {
    if (error.name !== 'AbortError') {
      showState(byId('search-panel'), {
        title: 'Search failed',
        message: describeError(error),
        action: 'retry-search',
        actionLabel: 'Try again',
      });
    }
  }
};

const debouncedSearch = debounce(runSearch);

const handleSearchInput = (value) => {
  state.query = value.trim();
  if (state.query.length < 2) {
    searchController?.abort();
    state.searchResults = null;
    clearState(byId('search-panel'));
    return;
  }
  debouncedSearch(state.query);
};

const clearSearch = () => {
  byId('search').value = '';
  handleSearchInput('');
};

const openDetail = async (coinId) => {
  const dialog = byId('detail');
  const content = byId('detail-content');
  
  // Close mobile menu if open
  const mobileNav = byId('mobile-nav');
  if (mobileNav && mobileNav.classList.contains('active')) {
    mobileNav.classList.remove('active');
    const hb = byId('hamburger');
    if (hb) hb.setAttribute('aria-expanded', 'false');
  }

  // If a different coin is already open, close and reopen for fresh state
  if (dialog.open && dialog.dataset.coinId !== coinId) {
    dialog.close();
  }

  dialog.dataset.coinId = coinId;
  if (!dialog.open) dialog.showModal();

  const cached = detailCache.get(coinId);
  if (cached && Date.now() - cached.time < DETAIL_TTL) {
    renderDetail(cached.coin, state.currency);
    return;
  }

  showState(content, { title: 'Loading coin details', message: 'Fetching the latest market data…' });
  try {
    const coin = await fetchCoinDetail(coinId);
    detailCache.set(coinId, { coin, time: Date.now() });
    // Only render if dialog is still open and showing this coin
    if (dialog.open && dialog.dataset.coinId === coinId) {
      renderDetail(coin, state.currency);
    }
  } catch (error) {
    if (dialog.dataset.coinId === coinId) {
      showState(content, {
        title: 'Could not load details',
        message: describeError(error),
        action: 'retry-detail',
        actionLabel: 'Try again',
      });
    }
  }
};

const setView = (view) => {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  byId('app').dataset.view = view;
  if (view === 'watchlist') loadWatchlist();
  render();
};

const setFilter = (filter) => {
  state.filter = filter;
  document.querySelectorAll('.chip').forEach((chip) => {
    const active = chip.dataset.filter === filter;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  render();
};

const refreshData = () => {
  loadMarkets();
  if (state.view === 'watchlist') loadWatchlist();
};

const changeCurrency = (currency) => {
  state.currency = currency;
  writeStorage(CURRENCY_KEY, currency);
  renderHeader(state.summary, currency);
  loadMarkets();
  if (state.view === 'watchlist') loadWatchlist();
};

const handleClick = (event) => {
  if (event.target === byId('detail')) {
    byId('detail').close();
    return;
  }

  const control = event.target.closest('[data-action]');
  if (!control) return;
  const { action, view, filter, coinId } = control.dataset;

  const actions = {
    nav: () => {
      setView(view);
      // Close hamburger menu after navigation
      const nav = byId('mobile-nav');
      if (nav && nav.classList.contains('active')) {
        nav.classList.remove('active');
        const hb = byId('hamburger');
        if (hb) hb.setAttribute('aria-expanded', 'false');
      }
    },
    'focus-search': () => byId('search').focus(),
    filter: () => setFilter(filter),
    'toggle-watch': () => handleToggleWatch(coinId),
    details: () => openDetail(coinId),
    'close-detail': () => byId('detail').close(),
    refresh: refreshData,
    retry: refreshData,
    'retry-search': () => runSearch(state.query),
    'retry-detail': () => openDetail(byId('detail').dataset.coinId),
    'clear-filters': () => setFilter('all'),
    'clear-search': clearSearch,
    'show-markets': () => setView('markets'),
  };

  actions[action]?.();
};

const init = () => {
  byId('today').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  byId('currency').value = state.currency;

  // Hamburger menu toggle (mobile only)
  const hamburger = byId('hamburger');
  const mobileNav = byId('mobile-nav');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      // Only toggle if hamburger is actually visible (mobile)
      if (window.getComputedStyle(hamburger).display !== 'none') {
        const isActive = mobileNav.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', String(isActive));
      }
    });
  }

  // Nav item click handler - to close menu after navigation (mobile only)
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      // Handle navigation
      const view = item.dataset.view;
      if (view) {
        setView(view);
      }
      
      // Close hamburger menu on mobile only
      if (hamburger && window.getComputedStyle(hamburger).display !== 'none') {
        if (mobileNav && mobileNav.classList.contains('active')) {
          mobileNav.classList.remove('active');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });

  // Handle window resize to close menu when switching to tablet/desktop
  window.addEventListener('resize', () => {
    if (hamburger && window.getComputedStyle(hamburger).display === 'none') {
      // On tablet/desktop, ensure menu is in correct state
      if (mobileNav.classList.contains('active')) {
        mobileNav.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    }
  });

  const app = byId('app');
  app.addEventListener('click', handleClick);
  app.addEventListener('input', (event) => {
    if (event.target.id === 'search') handleSearchInput(event.target.value);
  });
  app.addEventListener('change', (event) => {
    if (event.target.id === 'sort') {
      state.sort = event.target.value;
      render();
    } else if (event.target.id === 'currency') {
      changeCurrency(event.target.value);
    }
  });

  loadMarkets();
};

init();
