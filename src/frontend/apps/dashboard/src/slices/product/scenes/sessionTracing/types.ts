import {
  DashboardInstanceSessionsConnectionsListOutput,
  DashboardInstanceSessionsEventsListOutput
} from '@metorial/dashboard-sdk';
import { ReactNode } from 'react';

export type SessionEvent = DashboardInstanceSessionsEventsListOutput['items'][number];
export type SessionConnection =
  DashboardInstanceSessionsConnectionsListOutput['items'][number];
export type TracingConnectionItem = SessionConnection & { hasErrors?: boolean | null };
export type PlaceholderConnectionItem = {
  kind: 'placeholder';
  id: string;
  tabId: string;
  label: string;
  createdAt: Date;
};
export type TracingConnectionRowItem =
  | ({ kind: 'connection' } & TracingConnectionItem)
  | PlaceholderConnectionItem;
export type GroupedConnectionItems = {
  label: string;
  items: TracingConnectionRowItem[];
  dayTime: number;
};
export type TimelineItem = { component: ReactNode; time: Date };
