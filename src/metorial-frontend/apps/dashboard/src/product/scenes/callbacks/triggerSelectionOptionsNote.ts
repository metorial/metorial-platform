import type { DashboardInstanceCallbacksListTriggerSelectionOptionsOutput } from '@metorial/dashboard-sdk';

type OptionsList = Pick<
  DashboardInstanceCallbacksListTriggerSelectionOptionsOutput,
  'source' | 'linkedProvider'
>;

type NoteProvider = NonNullable<OptionsList['linkedProvider']>['provider'];

export type SelectionOptionsNote =
  | { kind: 'listed_through'; text: string }
  | {
      kind: 'not_connected';
      provider: NoteProvider;
      text: string;
      linkLabel: string;
      linkSuffix: string;
    };

export let getSelectionOptionsNote = (
  list: OptionsList | null | undefined
): SelectionOptionsNote | null => {
  if (!list?.linkedProvider) return null;

  let { provider, connectionStatus } = list.linkedProvider;

  if (list.source === 'linked_provider') {
    return {
      kind: 'listed_through',
      text: `Listed through the ${provider.name} connection for this account.`
    };
  }

  if (connectionStatus === 'not_connected') {
    return {
      kind: 'not_connected',
      provider,
      text: 'Only items this connection can open are listed.',
      linkLabel: `Connect ${provider.name}`,
      linkSuffix: ' with the same account to see all of them, or paste a value.'
    };
  }

  return null;
};
