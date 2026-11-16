import type { ContentPolicy, NormalizedRecord, RecordLane } from '@mtsrc/agent-tracking-spec';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import { createOrganizationKeyDeriver } from '@mtsrc/agent-tracking-crypto';
import { buildRecord, type BuildContext } from '@mtsrc/agent-tracking-records-model';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import type { Mapped } from '../src/types';
import {
  principalFixture,
  type PrincipalOverrides
} from '@mtsrc/agent-tracking-records-model/test/principal';

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
