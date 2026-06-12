import { marketauxProvider } from './marketaux';
import { finnhubProvider } from './finnhub';
import type { NewsProvider } from './types';

export const activeProviders: NewsProvider[] = [
  marketauxProvider,
  finnhubProvider,
];

export type { NewsProvider, NormalizedNewsItem } from './types';
