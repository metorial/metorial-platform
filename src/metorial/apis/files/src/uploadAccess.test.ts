import { beforeEach, describe, expect, it, vi } from 'vitest';

let accessService = vi.hoisted(() => ({
  checkAccess: vi.fn(),
  accessInstance: vi.fn(),
  checkTargetAccess: vi.fn(),
  canAccessTargetScopes: vi.fn()
}));
let getInstanceCargoAccess = vi.hoisted(() =>
  vi.fn((ctx: any) => ({
    scope: {
    },
    resourceActor: ctx.resourceActor,
    authorization: ctx.consumerProfile
      ? {
          type: 'restricted',
          resourceActor: ctx.resourceActor,
          accessTags: ctx.accessTags
        }
      : {
          type: 'privileged',
          resourceActor: ctx.resourceActor
        }
  }))
);

vi.mock('@metorial/module-access', () => ({
  accessService
}));

vi.mock('@metorial/cargo-module-file', () => ({
  getInstanceCargoAccess
}));

vi.mock('@metorial/module-organization', () => ({
  organizationService: {
    getOrganizationByIdForUser: vi.fn()
  }
}));

import { resolveUploadTarget } from './uploadAccess';

let project = { oid: 6n, id: 'prj_1' } as any;
let instance = {
  oid: 3n,
  id: 'ins_1',
  slug: 'instance',
  projectOid: project.oid
} as any;
let organization = { oid: 4n, id: 'org_1' } as any;
let organizationActor = { oid: 5n, id: 'oac_1', name: 'Organization actor' } as any;
let consumerProfile = {
  oid: 7n,
  id: 'cpf_1',
  name: 'Consumer profile',
  instanceOid: instance.oid,
  consumer: {
    oid: 8n,
    id: 'con_1',
    name: 'Consumer'
  }
} as any;
let consumerResourceActor = {
  oid: 9n,
  id: 'rac_consumer',
  projectOid: project.oid,
  consumerProfileOid: consumerProfile.oid
} as any;
let organizationResourceActor = {
  oid: 10n,
  id: 'rac_organization',
  projectOid: project.oid,
  organizationActorOid: organizationActor.oid
} as any;
let accessTags = [11n, 12n];

let getInstanceAccess = (resourceActor: any) => ({
  type: 'actor' as const,
  instance,
  organization,
  actor: organizationActor,
  project,
  resourceActor
});

describe('file upload access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessService.checkAccess.mockResolvedValue(undefined);
    accessService.checkTargetAccess.mockResolvedValue(undefined);
    accessService.canAccessTargetScopes.mockResolvedValue(true);
  });

  it('preserves consumer tags in restricted Cargo authorization', async () => {
    accessService.accessInstance.mockResolvedValue(
      getInstanceAccess(consumerResourceActor)
    );
    let auth = {
      type: 'machine',
      machineAccess: { type: 'instance_publishable' },
      orgScopes: ['consumer#instance.file:write'],
      restrictions: {
        type: 'instance',
        organization,
        actor: organizationActor,
        instance,
        resourceActor: consumerResourceActor,
        consumer: {
          consumerProfile,
          accessTags
        }
      }
    } as any;

    let target = await resolveUploadTarget({
      auth,
      instanceId: instance.id
    });

    expect(getInstanceCargoAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerProfile,
        resourceActor: consumerResourceActor,
        accessTags
      })
    );
    expect(target.cargoAccess?.authorization).toEqual({
      type: 'restricted',
      resourceActor: consumerResourceActor,
      accessTags
    });
  });

  it('keeps non-consumer instance uploads privileged', async () => {
    accessService.accessInstance.mockResolvedValue(
      getInstanceAccess(organizationResourceActor)
    );
    let auth = {
      type: 'machine',
      machineAccess: { type: 'instance_secret' },
      orgScopes: ['instance.file:write'],
      restrictions: {
        type: 'instance',
        organization,
        actor: organizationActor,
        instance,
        resourceActor: organizationResourceActor
      }
    } as any;

    let target = await resolveUploadTarget({
      auth,
      instanceId: instance.id
    });

    expect(target.cargoAccess?.authorization).toEqual({
      type: 'privileged',
      resourceActor: organizationResourceActor
    });
  });
});
