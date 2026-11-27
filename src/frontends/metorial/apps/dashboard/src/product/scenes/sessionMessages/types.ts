import type { DashboardInstanceSessionsMessagesGetOutput } from '@metorial/dashboard-sdk';
import type { ReactNode } from 'react';

export type OverviewSection = {
  id: string;
  label?: string;
  content: ReactNode;
};

export type EntityDetail = {
  label: string;
  value: ReactNode;
};

export type MessagePresentation = {
  defaultViewMode?: 'overview' | 'properties' | 'raw';
  hideCard?: boolean;
  label: ReactNode;
  overviewSections?: OverviewSection[];
  summaryIcon: ReactNode;
  summaryText: ReactNode;
};

export type MessagePayload = Record<string, any>;

export type TransportMeta = {
  client?: Record<string, any> | null;
  server?: Record<string, any> | null;
} | null;

export type { DashboardInstanceSessionsMessagesGetOutput };
