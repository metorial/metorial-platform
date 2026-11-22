import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceCallbackTriggerSelectionOptionsListOutput = {
  object: 'list';
  items: {
    object: 'callback.trigger_selection_option';
    value: string | number;
    label: string;
    description: string | null;
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapDashboardInstanceCallbackTriggerSelectionOptionsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceCallbackTriggerSelectionOptionsListOutput>(
    [7, 0]
  );

export type DashboardInstanceCallbackTriggerSelectionOptionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  callbackId: string;
  triggerGroupKey: string;
  field: string;
  callbackInstanceId?: string | undefined;
  search?: string | undefined;
};

export let mapDashboardInstanceCallbackTriggerSelectionOptionsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceCallbackTriggerSelectionOptionsListQuery>(
    [
      3,
      [[0, [1, ['callback_id', 'trigger_group_key', 'callback_instance_id']]]]
    ]
  );
