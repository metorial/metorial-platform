import { Context } from '@metorial/context';
import { db } from '@metorial/db';
import { ServiceError } from '@mtsrc/error';
import { UnifiedApiKey } from '@metorial/api-keys';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fineGrainedAuthService } from '../src/services/fineGrainedAuth';

vi.mock('@metorial/db', () => ({
  db: {
    fineGrainedKey: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('@metorial/api-keys', () => ({
  UnifiedApiKey: {
    from: vi.fn()
  }
}));

describe('fineGrainedAuthService', () => {
  let context: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    context = { ip: '127.0.0.1' } as Context;
  });

  it('authenticates and resolves policy scopes and explicit session IDs', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'fine_grained_token' });
    (db.fineGrainedKey.findUnique as any).mockResolvedValue({
      oid: 1n,
      status: 'active',
      expiresAt: null,
      lastUsedAt: null,
      instance: {
        id: 'ins_1',
        organization: { id: 'org_1' },
        project: { id: 'prj_1' }
      },
      accessTag: {
        accessTagEntities: [
          {
            subspaceSessionId: 'ses_1',
            accessTagPolicy: { roles: ['instance.provider.session:read', 'not.a.scope'] }
          },
          {
            subspaceSessionId: 'ses_2',
            accessTagPolicy: { roles: ['instance.provider.session:read'] }
          },
          {
            subspaceSessionId: null,
            accessTagPolicy: { roles: ['instance.provider.session:read'] }
          }
        ]
      }
    });

    let result = await fineGrainedAuthService.authenticateWithFineGrainedToken({
      token: 'metorial_fk_test',
      context
    });

    expect(result.orgScopes).toEqual(['instance.provider.session:read']);
    expect(result.accessTagGrants).toEqual([
      {
        resourceType: 'subspace.session',
        resourceId: 'ses_1',
        roles: ['instance.provider.session:read']
      },
      {
        resourceType: 'subspace.session',
        resourceId: 'ses_2',
        roles: ['instance.provider.session:read']
      }
    ]);
    expect(db.fineGrainedKey.update).toHaveBeenCalled();
  });

  it('rejects non fine-grained keys', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'instance_access_token_secret' });

    await expect(
      fineGrainedAuthService.authenticateWithFineGrainedToken({
        token: 'metorial_sk_bad',
        context
      })
    ).rejects.toThrow(ServiceError);
  });

  it('rejects inactive keys', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'fine_grained_token' });
    (db.fineGrainedKey.findUnique as any).mockResolvedValue({
      oid: 1n,
      status: 'deleted',
      expiresAt: null,
      lastUsedAt: new Date(),
      instance: { id: 'ins_1', organization: { id: 'org_1' }, project: { id: 'prj_1' } },
      accessTag: { accessTagEntities: [] }
    });

    await expect(
      fineGrainedAuthService.authenticateWithFineGrainedToken({
        token: 'metorial_fk_bad',
        context
      })
    ).rejects.toThrow(ServiceError);
  });
});
