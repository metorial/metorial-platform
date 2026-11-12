import type {
  ContentPolicy,
  NormalizedRecord,
  RecordLane
} from '@metorial/groundstation-spec';
import type { IngestPrincipal } from '../auth/principal';
import { createTenantKeyDeriver } from '../crypto/keys';
import { buildRecord, type BuildContext } from '../records/builder';
import type { RecordDraft } from '../records/draft';
import type { Mapped } from '../dialects/types';

export let buildNow = new Date('2026-06-15T12:00:00.000Z');

export let unitPrincipal = (
  overrides: {
    contentPolicy?: ContentPolicy;
    skewBoundSeconds?: number;
    principalRef?: string | null;
  } = {}
): IngestPrincipal => ({
  tokenId: 'itk_unit',
  principalRef: overrides.principalRef === undefined ? 'user_1' : overrides.principalRef,
  contentPolicy: overrides.contentPolicy ?? { defaultMode: 'basic' },
  limits: {},
  allowedClients: [],
  allowedChannels: [],
  tenant: {
    id: 'gst_unit',
    ref: 'org_unit',
    skewBoundSeconds: overrides.skewBoundSeconds ?? 300,
    backfillMaxAgeDays: 30,
    hashKeyVersion: 1
  }
});

let keys = createTenantKeyDeriver('unit-test-secret');

export let unitTenantKey = (principal: IngestPrincipal = unitPrincipal()) =>
  keys.forTenant({
    id: principal.tenant.id,
    hashKeyVersion: principal.tenant.hashKeyVersion
  });

export let unitContext = (
  overrides: Partial<BuildContext> & { principal?: IngestPrincipal } = {}
): BuildContext => {
  let principal = overrides.principal ?? unitPrincipal();

  return {
    principal,
    tenantKey: unitTenantKey(principal),
    requestId: 'req_unit',
    route: 'hook',
    observedAt: buildNow,
    lane: 'live' as RecordLane,
    ...overrides
  };
};

export let buildMapped = (
  mapped: Mapped,
  overrides: Partial<BuildContext> & { principal?: IngestPrincipal } = {}
): NormalizedRecord => buildRecord(unitContext(overrides), mapped.source, mapped.draft);

export let buildDraft = (
  draft: RecordDraft,
  overrides: Partial<BuildContext> & { principal?: IngestPrincipal } = {},
  source: Mapped['source'] = { adapter: 'test', dialect: 'test.v1', channel: 'hook' }
): NormalizedRecord => buildRecord(unitContext(overrides), source, draft);
