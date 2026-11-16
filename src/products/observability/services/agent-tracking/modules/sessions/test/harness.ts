import type { IngestChannel, NormalizedRecord, RecordRole } from '@mtsrc/agent-tracking-spec';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import { createOrganizationKeyDeriver } from '@mtsrc/agent-tracking-crypto';
import type { PipelineContext } from '@mtsrc/agent-tracking-module-ingest';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { createRuntime, setRuntime } from '@mtsrc/agent-tracking-module-ingest';
import { createMongoSink, setRecordSink } from '@mtsrc/agent-tracking-module-records';
import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';
import { createContentCipher } from '@mtsrc/agent-tracking-crypto';
import { getStore } from '@mtsrc/agent-tracking-store';
import { buildDraft, unitPrincipal } from '@mtsrc/agent-tracking-dialects/test/build';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import type { InstanceSettings } from '@mtsrc/agent-tracking-spec';
import { createSessionStage } from '../src/lib/stage';

let minuteMs = 60 * 1000;

export let store = getStore();

export let minutesAfter = (base: Date, minutes: number) =>
  new Date(base.getTime() + minutes * minuteMs);

export type DraftInput = {
  type: string;
  at: Date;
  kind?: RecordDraft['kind'];
  sessionId?: string;
  ctx?: RecordDraft['ctx'];
  data?: Record<string, unknown>;
  content?: RecordDraft['content'];
  channel?: IngestChannel;
  role?: RecordRole;
  identity?: string;
  family?: string;
};

export let createSessionHarness = async (
  d: {
    settings?: InstanceSettings;
    principal?: Partial<IngestPrincipal['binding']>;
    scope?: Parameters<typeof createTestScope>[0];
  } = {}
) => {
  let scope = await createTestScope(d.scope);

  let principal = unitPrincipal({
    organization: { id: scope.organization.id },
    project: { id: scope.project.id },
    instance: { id: scope.instance.id, settings: d.settings ?? {} },
    binding: d.principal
  });

  let sink = createMongoSink({
    store,
    cipher: createContentCipher('integration-content-secret')
  });
  setRecordSink(sink);
  setRuntime(createRuntime({ stages: [] }));

  let stage = createSessionStage({ keys: createOrganizationKeyDeriver('unit-test-secret') });

  let draft = (input: DraftInput, observedAt: Date) =>
    buildDraft(
      {
        kind: input.kind ?? 'event',
        type: input.type,
        identity: input.identity ?? crypto.randomUUID(),
        occurredAt: input.at,
        role: input.role,
        client: { family: input.family ?? 'claude-code', version: '2.1.0' },
        ctx: { ...(input.sessionId ? { sessionId: input.sessionId } : {}), ...input.ctx },
        data: input.data,
        content: input.content
      },
      { principal, observedAt },
      { adapter: 'test', dialect: 'test.v1', channel: input.channel ?? 'hook' }
    );

  let ingestRecords = async (records: NormalizedRecord[], observedAt: Date) => {
    let context = {
      request: { principal, requestId: crypto.randomUUID() },
      lane: 'live',
      observedAt
    } as unknown as PipelineContext;

    await stage.beforeWrite!(context, records);

    await sink.write({
      lane: 'live',
      organizationId: principal.organization.id,
      projectId: principal.project.id,
      instanceId: principal.instance.id,
      storage: defaultStoragePolicy,
      records
    });

    await stage.afterWrite!(context, records);

    return records;
  };

  let ingest = async (inputs: DraftInput[], observedAt = new Date()) =>
    await ingestRecords(
      inputs.map(input => draft(input, observedAt)),
      observedAt
    );

  let collections = () => store.collections();

  let session = async (sessionKey: string) =>
    await collections().sessions.findOne({ _id: sessionKey });

  return { scope, principal, ingest, ingestRecords, draft, collections, session };
};
