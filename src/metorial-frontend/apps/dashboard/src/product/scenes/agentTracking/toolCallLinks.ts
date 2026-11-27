import type { DashboardInstanceAgentTrackingToolCallSessionsListOutput } from '@metorial/dashboard-sdk';
import { repositoryLabel } from './sessionContext';
import { clientLabel } from './spendSummary';

export let maxToolCallSessionLookups = 100;

type ToolCallSession =
  DashboardInstanceAgentTrackingToolCallSessionsListOutput['items'][number];

export type AgentSession = ToolCallSession['session'];

export let toolCallSessionLookupIds = (items: { id: string }[]) =>
  items.slice(0, maxToolCallSessionLookups).map(item => item.id);

export let agentSessionsByToolCall = (items: ToolCallSession[] | null | undefined) =>
  new Map((items ?? []).map(item => [item.toolCallId, item.session]));

export let agentSessionSummary = (session: Pick<AgentSession, 'client' | 'context'>) => {
  let [repository] = session.context.repositories;
  let [ticket] = session.context.tickets;
  let details = [
    repository ? repositoryLabel(repository) : null,
    session.context.branch,
    ticket?.key
  ].filter((value): value is string => !!value);

  return {
    client: clientLabel(session.client),
    details: details.length ? details.join(' · ') : null
  };
};

export let sessionToolCallNotes = (d: { unmatchedCount: number | null; hasMore: boolean }) =>
  [
    d.unmatchedCount
      ? `${d.unmatchedCount.toLocaleString('en-US')} other MCP tool ${d.unmatchedCount == 1 ? 'call' : 'calls'} of this session ${d.unmatchedCount == 1 ? 'is' : 'are'} not linked to a Metorial tool call you can see.`
      : null,
    d.hasMore
      ? 'This list is cut off, so some tool calls of this session are not shown.'
      : null
  ].filter((note): note is string => !!note);

export type ToolCallsListMode = 'plain' | 'agentSessions' | 'pending';

export let toolCallsListMode = (d: {
  enabled: boolean;
  scopes: { loaded: boolean; hasScope: boolean };
  settings: { loaded: boolean; failed: boolean; hideIndividuals: boolean };
}): ToolCallsListMode => {
  if (!d.enabled) return 'plain';
  if (!d.scopes.loaded) return 'pending';
  if (!d.scopes.hasScope || d.settings.failed) return 'plain';
  if (!d.settings.loaded) return 'pending';

  return d.settings.hideIndividuals ? 'plain' : 'agentSessions';
};
