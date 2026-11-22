import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiToolsGetOutput = {
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
};

export let mapDashboardInstanceAiToolsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAiToolsGetOutput>(
    [
      ['policy', 0, [1, ['decided_at']]],
      'device_count',
      'people_count',
      'last_seen_at'
    ],
    1
  );
