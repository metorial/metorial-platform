import { hc } from 'hono/client';
import type { marketplaceApp } from './index';

export type AppType = typeof marketplaceApp;

export let createMarketplaceClient = (url: string) => hc<AppType>(url);
