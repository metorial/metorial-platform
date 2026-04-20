import {
  DashboardInstanceSessionsConnectionsListOutput,
  DashboardInstanceSessionsEventsListOutput
} from '@metorial/dashboard-sdk';
import { ReactNode } from 'react';

export type SessionEvent = DashboardInstanceSessionsEventsListOutput['items'][number];
export type SessionConnection =
  DashboardInstanceSessionsConnectionsListOutput['items'][number];
export type TracingConnectionItem = SessionConnection & { hasErrors?: boolean | null };
export type GroupedConnectionItems = {
  label: string;
  items: TracingConnectionItem[];
  dayTime: number;
};
export type TimelineItem = { component: ReactNode; time: Date };
