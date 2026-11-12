const BASE_URL = 'https://api.coingecko.com/api/v3';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const request = async (path, params = {}, signal) => {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Network error. Check your connection and try again.');
  }

  if (response.status === 429) {
    throw new ApiError('CoinGecko rate limit reached. Wait about a minute, then try again.', 429);
  }
  if (!response.ok) {
    throw new ApiError(`CoinGecko returned an error (${response.status}).`, response.status);
  }
  return response.json();
};

export const describeError = (error) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

export const fetchMarkets = (currency, ids = []) =>
  request('/coins/markets', {
    vs_currency: currency,
    order: 'market_cap_desc',
    per_page: ids.length || 20,
    page: 1,
    sparkline: false,
    price_change_percentage: '24h',
    ...(ids.length ? { ids: ids.join(',') } : {}),
  });

export const fetchGlobal = async () => (await request('/global')).data;

export const searchCoins = async (query, signal) => (await request('/search', { query }, signal)).coins;

export const fetchCoinDetail = (coinId) =>
  request(`/coins/${encodeURIComponent(coinId)}`, {
    localization: false,
    tickers: false,
    community_data: false,
    developer_data: false,
    sparkline: false,
  });
