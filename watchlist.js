import { readStorage, writeStorage } from './utils.js';

const STORAGE_KEY = 'coinwallet.watchlist';

const stored = readStorage(STORAGE_KEY, []);
const watchedIds = new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []);

export const getWatchlist = () => [...watchedIds];

export const isWatched = (coinId) => watchedIds.has(coinId);

export const toggleWatch = (coinId) => {
  if (watchedIds.has(coinId)) {
    watchedIds.delete(coinId);
  } else {
    watchedIds.add(coinId);
  }
  writeStorage(STORAGE_KEY, [...watchedIds]);
  return watchedIds.has(coinId);
};
