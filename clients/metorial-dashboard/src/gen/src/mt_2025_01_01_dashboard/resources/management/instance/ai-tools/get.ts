import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAiToolsGetOutput = {
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
  activelyUsed: boolean;
  lastUsedAt: Date | null;
};

export let mapManagementInstanceAiToolsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceAiToolsGetOutput>(
    [
      ['policy', 0, [1, ['decided_at']]],
      'device_count',
      'people_count',
      'last_seen_at',
      'actively_used',
      'last_used_at'
    ],
    1
  );
