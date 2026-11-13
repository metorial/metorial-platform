import type {
  ContentPolicy,
  NormalizedRecord,
  RecordLane
} from '@metorial/groundstation-spec';
import type { IngestPrincipal } from '../auth/principal';
import { createOrganizationKeyDeriver } from '../crypto/keys';
import { buildRecord, type BuildContext } from '../records/builder';
import type { RecordDraft } from '../records/draft';
import type { Mapped } from '../dialects/types';
import { principalFixture, type PrincipalOverrides } from './principal';

export let buildNow = new Date('2026-06-15T12:00:00.000Z');

export let unitPrincipal = (overrides: PrincipalOverrides = {}): IngestPrincipal =>
  principalFixture({ suffix: 'unit' }, overrides);

let keys = createOrganizationKeyDeriver('unit-test-secret');

export let unitOrganizationKey = (principal: IngestPrincipal = unitPrincipal()) =>
  keys.forOrganization(principal.organization);

export let unitContext = (
  overrides: Partial<BuildContext> & { principal?: IngestPrincipal } = {}
): BuildContext => {
  let principal = overrides.principal ?? unitPrincipal();

  return {
    principal,
    organizationKey: unitOrganizationKey(principal),
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
