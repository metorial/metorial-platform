import { mapObject } from '@metorial/util-resource-mapper/compact';

export type CallbacksListTriggerSelectionOptionsOutput = {
  object: 'list';
  items: {
    object: 'callback.trigger_selection_option';
    value: string | number;
    label: string;
    description: string | null;
  }[];
  source: 'callback' | 'linked_provider';
  linkedProvider: {
    object: 'callback.trigger_selection_linked_provider';
    provider: {
      object: 'provider#preview';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    };
    connectionStatus: 'connected' | 'not_connected';
  } | null;
  nextPageToken: string | null;
};

export let mapCallbacksListTriggerSelectionOptionsOutput =
  /* @__PURE__ */ mapObject<CallbacksListTriggerSelectionOptionsOutput>([
    ['linked_provider', 1, [1, [['provider', 0, 8], 'connection_status']]],
    'next_page_token'
  ]);

export type CallbacksListTriggerSelectionOptionsBody = {
  triggerGroupKey: string;
  field: string;
  callbackInstanceId?: string | undefined;
  query?: string | undefined;
  pageToken?: string | undefined;
  selection?: Record<string, any> | undefined;
};

export let mapCallbacksListTriggerSelectionOptionsBody =
  /* @__PURE__ */ mapObject<CallbacksListTriggerSelectionOptionsBody>([
    'trigger_group_key',
    'callback_instance_id',
    'page_token'
  ]);
