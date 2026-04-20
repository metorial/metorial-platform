import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { theme } from '@metorial/ui';
import {
  GroupedConnectionItems,
  SessionConnection,
  SessionEvent,
  TracingConnectionItem
} from './types';

export let CONNECT_TAB_ID = '__connect__';
export let EXPLORER_TAB_PREFIX = '__explorer_';

export let isExplorerTabId = (id: string) => id.startsWith(EXPLORER_TAB_PREFIX);

export let getEventConnectionId = (evt: SessionEvent) =>
  evt.connection?.id ??
  evt.providerRun?.connectionId ??
  evt.message?.connectionId ??
  evt.error?.connectionId ??
  evt.warning?.connectionId ??
  '__ungrouped';

export let formatConnectionLabel = (
  connection: SessionConnection,
  session: DashboardInstanceSessionsGetOutput
) =>
  connection.participant?.name ??
  connection.mcp?.transport ??
  session.providers?.[0]?.deployment?.name ??
  `Connection ${connection.id.slice(0, 8)}...`;

export let formatGroupDateLabel = (date: Date) => {
  let groupDay = new Date(date);
  groupDay.setHours(0, 0, 0, 0);

  let today = new Date();
  today.setHours(0, 0, 0, 0);

  let yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (groupDay.getTime() === today.getTime()) return 'Today';
  if (groupDay.getTime() === yesterday.getTime()) return 'Yesterday';

  return groupDay.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

export let getConnectionAccentColor = ({
  hasErrors,
  connectionState
}: {
  hasErrors?: boolean | null;
  connectionState?: SessionConnection['connectionState'];
}) => {
  if (hasErrors) return { full: theme.colors.red600, color: 'red' as const };
  if (connectionState === 'connected')
    return { full: theme.colors.primary, color: 'blue' as const };
  return { full: theme.colors.gray500, color: 'gray' as const };
};

export let isMetorialExplorerConnection = (connection: SessionConnection) => {
  let participantName = connection.participant?.name?.trim().toLowerCase();
  return participantName === 'metorial explorer';
};

export let reorderList = (
  items: string[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after'
) => {
  let sourceIndex = items.indexOf(sourceId);
  let targetIndex = items.indexOf(targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return items;

  let next = [...items];
  let [moved] = next.splice(sourceIndex, 1);
  let adjustedTargetIndex = next.indexOf(targetId);
  let insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
  next.splice(insertIndex, 0, moved);
  return next;
};

export let groupConnectionsByDay = (connectionItems: TracingConnectionItem[]) => {
  let grouped = new Map<string, GroupedConnectionItems>();

  for (let connection of connectionItems) {
    let date = new Date(connection.createdAt);
    let day = new Date(date);
    day.setHours(0, 0, 0, 0);
    let key = day.toDateString();
    let existing = grouped.get(key);

    if (existing) {
      existing.items.push(connection);
      continue;
    }

    grouped.set(key, {
      label: formatGroupDateLabel(connection.createdAt),
      items: [connection],
      dayTime: day.getTime()
    });
  }

  let sortedGroups = Array.from(grouped.values()).sort((a, b) => b.dayTime - a.dayTime);

  for (let group of sortedGroups) {
    group.items.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  return sortedGroups;
};
