import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiToolsListOutput = {
  object: 'list';
  items: {
    object: 'ai_tool';
    key: string;
    name: string;
    description: string;
    maker: { id: string; name: string };
    website: string | null;
    surfaces: ('cli' | 'ide' | 'ide-extension' | 'desktop' | 'web' | 'cloud')[];
    policy: {
      status: 'sanctioned' | 'not_sanctioned' | 'unreviewed';
      note: string | null;
      decidedAt: Date | null;
    };
    deviceCount: number;
    peopleCount: number;
    lastSeenAt: Date | null;
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapDashboardInstanceAiToolsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAiToolsListOutput>(
    [
      7,
      [
        1,
        [
          ['policy', 0, [1, ['decided_at']]],
          'device_count',
          'people_count',
          'last_seen_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceAiToolsListQuery = {
  policyStatus?:
    | 'sanctioned'
    | 'not_sanctioned'
    | 'unreviewed'
    | ('sanctioned' | 'not_sanctioned' | 'unreviewed')[]
    | undefined;
  detected?: boolean | undefined;
};

export let mapDashboardInstanceAiToolsListQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAiToolsListQuery>([
    'policy_status'
  ]);
