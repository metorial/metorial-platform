import type { IngestPrincipal } from '../auth/principal';

export type PrincipalOverrides = Partial<
  Omit<IngestPrincipal, 'credential' | 'binding' | 'organization' | 'project' | 'instance'>
> & {
  credential?: Partial<IngestPrincipal['credential']>;
  binding?: Partial<IngestPrincipal['binding']>;
  organization?: Partial<IngestPrincipal['organization']>;
  project?: Partial<IngestPrincipal['project']>;
  instance?: Partial<IngestPrincipal['instance']>;
};

export let principalFixture = (
  base: { suffix: string },
  overrides: PrincipalOverrides = {}
): IngestPrincipal => ({
  contentPolicy: { defaultMode: 'basic' },
  limits: {},
  allowedClients: [],
  allowedChannels: [],
  tags: [],
  ...overrides,

  credential: { kind: 'token', id: `git_${base.suffix}`, ...overrides.credential },
  binding: {
    userId: `gen_user_${base.suffix}`,
    deviceId: `gen_device_${base.suffix}`,
    deviceMode: 'bound',
    ...overrides.binding
  },
  organization: {
    id: `gor_${base.suffix}`,
    ref: `org_${base.suffix}`,
    hashKeyVersion: 1,
    contentKeyVersion: 1,
    settings: {},
    ...overrides.organization
  },
  project: { id: `gpr_${base.suffix}`, ref: `proj_${base.suffix}`, ...overrides.project },
  instance: {
    id: `gin_${base.suffix}`,
    ref: `inst_${base.suffix}`,
    skewBoundSeconds: 300,
    backfillMaxAgeDays: 30,
    recordRetentionDays: 90,
    contentRetentionDays: 30,
    usageRetentionDays: 400,
    settings: {},
    ...overrides.instance
  }
});
