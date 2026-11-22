import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type AiToolsPolicyUpdateOutput = {
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

export let mapAiToolsPolicyUpdateOutput =
  /* @__PURE__ */ mapObject<AiToolsPolicyUpdateOutput>(
    [
      ['policy', 0, [1, ['decided_at']]],
      'device_count',
      'people_count',
      'last_seen_at'
    ],
    1
  );

export type AiToolsPolicyUpdateBody = {
  status?: 'sanctioned' | 'not_sanctioned' | 'unreviewed' | undefined;
  note?: string | null | undefined;
};

export let mapAiToolsPolicyUpdateBody =
  /* @__PURE__ */ createMapper<AiToolsPolicyUpdateBody>(0);
