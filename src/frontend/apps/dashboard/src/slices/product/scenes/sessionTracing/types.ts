import {
  DashboardInstanceProviderInvocationsListOutput,
  DashboardInstanceSessionsConnectionsListOutput,
  DashboardInstanceSessionsEventsListOutput,
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsMessagesGetOutput
} from '@metorial/dashboard-sdk';
import { ReactNode } from 'react';
import type { AggregatedMessages } from '../session/hooks/useAggregatedMessages';

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
export type TimelineItem = { id?: string; component: ReactNode; time: Date };

export type TimelineItemData =
  | { kind: 'session_created'; id: string; time: Date }
  | {
      kind: 'connection_marker';
      id: string;
      time: Date;
      variant: 'connected' | 'created';
    }
  | { kind: 'message'; id: string; time: Date; messageId: string }
  | { kind: 'explorer_capabilities'; id: string; time: Date; messageIds: string[] }
  | { kind: 'event'; id: string; time: Date; event: SessionEvent }
  | { kind: 'provider_run_logs'; id: string; time: Date; providerRunId: string }
  | { kind: 'invocation'; id: string; time: Date; invocationId: string };

export type TimelineRowContext = {
  aggregatedMessages: Map<string, AggregatedMessages>;
  clientName: string;
  invocationById: Map<
    string,
    DashboardInstanceProviderInvocationsListOutput['items'][number]
  >;
  messageById: Map<string, DashboardInstanceSessionsMessagesGetOutput>;
  session: DashboardInstanceSessionsGetOutput;
};
