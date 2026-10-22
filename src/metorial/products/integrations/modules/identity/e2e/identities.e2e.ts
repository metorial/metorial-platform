import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { afterEach, describe, expect, it } from 'vitest';
import {
  identityActorService,
  identityCredentialService,
  identityDelegationConfigService,
  identityService
} from '../src';
import {
  createActor,
  createIdentity,
  identityScope,
  pageAll,
  useRemoteProvider,
  waitForReconciliation
} from './_fixtures';

let searchToken = () => uniqueId('srch').replace(/-/g, '');

describe('module-identity identities', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let cleanups: (() => void)[] = [];

  afterEach(() => {
    for (let cleanup of cleanups.splice(0)) cleanup();
  });

  let listen = <K extends 'identity.created:after' | 'identity.deleted:after'>(event: K) => {
    let ids: string[] = [];
    cleanups.push(
      Fabric.listen(event, async payload => {
        ids.push(payload.identity.id);
      })
    );
    return ids;
  };

  it('creates, updates and archives an identity and persists every step', async () => {
    let scope = await identityScope(org);
    let { tenant, environment } = await resolveMetorialFacing(scope);
    let actor = await createActor(org);
    let name = uniqueId('identity');
    let created = listen('identity.created:after');
    let deleted = listen('identity.deleted:after');

    let identity = await identityService.createIdentity({
      ...scope,
      actor,
      input: {
        name: `  ${name}  `,
        description: 'Initial',
        metadata: { step: 1 },
        privateMetadata: { secret: 'value' },
        inputs: []
      }
    });
    expect(identity).toMatchObject({ name, description: 'Initial', status: 'active' });
    expect(identity.actor.id).toBe(actor.id);
    expect(identity.credentials).toEqual([]);
    expect(identity.delegationConfig).toBeNull();
    expect(created).toContain(identity.id);

    let row = await subspaceDb.identity.findUniqueOrThrow({ where: { id: identity.id } });
    expect(row).toMatchObject({
      status: 'active',
      actorOid: actor.oid,
      privateMetadata: { secret: 'value' },
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      instanceOid: environment.instanceOid,
      projectOid: tenant.projectOid,
      ownedByIntegrationInstanceOid: null
    });
    await waitForReconciliation(identity.id);

    let updated = await identityService.updateIdentity({
      ...scope,
      identity,
      input: { description: 'Updated' }
    });
    expect(updated).toMatchObject({ name, description: 'Updated', metadata: { step: 1 } });

    let renamed = await identityService.updateIdentity({
      ...scope,
      identity: updated,
      input: { name: `${name}-2`, metadata: { step: 2 } }
    });
    expect(renamed).toMatchObject({
      name: `${name}-2`,
      description: 'Updated',
      metadata: { step: 2 }
    });

    let archived = await identityService.archiveIdentity({ ...scope, identity: renamed });
    expect(archived.status).toBe('archived');
    expect(deleted).toContain(identity.id);
    expect(
      await subspaceDb.identity.findUniqueOrThrow({ where: { id: identity.id } })
    ).toMatchObject({
      status: 'archived',
      archivedAt: archived.archivedAt
    });
  });

  it('finds identities by search once they are indexed and drops them on archive', async () => {
    let scope = await identityScope(org);
    let token = searchToken();
    let identity = await createIdentity(org, {
      name: `Searchable ${token}`,
      description: 'Indexed by the integrations worker'
    });

    await eventually(
      async () => {
        let found = await firstPage(
          await identityService.listIdentities({ ...scope, search: token })
        );
        expect(found.map(item => item.id)).toEqual([identity.id]);
      },
      { timeoutMs: 15_000, intervalMs: 500 }
    );
    expect(
      await firstPage(
        await identityService.listIdentities({
          ...(await identityScope(otherOrg)),
          search: token
        })
      )
    ).toEqual([]);

    await identityService.archiveIdentity({ ...scope, identity });

    await eventually(
      async () => {
        let found = await firstPage(
          await identityService.listIdentities({
            ...scope,
            search: token,
            status: ['archived']
          })
        );
        expect(found).toEqual([]);
      },
      { timeoutMs: 15_000, intervalMs: 500 }
    );
  });

  it('pages through identities and filters them by actor, id and status', async () => {
    let scope = await identityScope(org);
    let actor = await createActor(org);
    let identities = await Promise.all([
      createIdentity(org, { actor }),
      createIdentity(org, { actor }),
      createIdentity(org, { actor })
    ]);
    let ids = identities.map(identity => identity.id);
    let otherIdentity = await createIdentity(org);

    let paged = await pageAll(
      await identityService.listIdentities({ ...scope, actorIds: [actor.id] })
    );
    expect(paged.map(item => item.id).sort()).toEqual([...ids].sort());

    let byId = await firstPage(
      await identityService.listIdentities({ ...scope, ids: [ids[1]!, otherIdentity.id] })
    );
    expect(byId.map(item => item.id).sort()).toEqual([ids[1], otherIdentity.id].sort());

    let byIdentityId = await firstPage(
      await identityService.listIdentities({ ...scope, identityIds: [otherIdentity.id] })
    );
    expect(byIdentityId.map(item => item.id)).toEqual([otherIdentity.id]);

    await identityService.archiveIdentity({ ...scope, identity: identities[0]! });

    let active = await firstPage(
      await identityService.listIdentities({ ...scope, actorIds: [actor.id] })
    );
    expect(active.map(item => item.id).sort()).toEqual([ids[1], ids[2]].sort());

    let archived = await firstPage(
      await identityService.listIdentities({
        ...scope,
        actorIds: [actor.id],
        status: ['archived']
      })
    );
    expect(archived.map(item => item.id)).toEqual([ids[0]]);
  });

  it('rejects identities for archived actors and edits of archived identities', async () => {
    let scope = await identityScope(org);
    let actor = await createActor(org);
    let archivedActor = await identityActorService.archiveIdentityActor({
      ...scope,
      identityActor: actor
    });
    let name = uniqueId('identity');

    await expectServiceError(
      identityService.createIdentity({
        ...scope,
        actor: archivedActor,
        input: { name, inputs: [] }
      }),
      'use_after_delete'
    );
    expect(await subspaceDb.identity.count({ where: { name } })).toBe(0);

    let identity = await createIdentity(org);
    let archived = await identityService.archiveIdentity({ ...scope, identity });

    await expectServiceError(
      identityService.updateIdentity({
        ...scope,
        identity: archived,
        input: { name: uniqueId('renamed') }
      }),
      'gone'
    );
    await expectServiceError(
      identityService.archiveIdentity({ ...scope, identity: archived }),
      'gone'
    );
    await expectServiceError(
      identityService.getIdentityById({ ...scope, identityId: uniqueId('missing') }),
      'not_found'
    );

    let fetched = await identityService.getIdentityById({ ...scope, identityId: identity.id });
    expect(fetched.status).toBe('archived');
  });

  it('does not resolve, list or modify identities of another tenant', async () => {
    let identity = await createIdentity(org);
    let otherScope = await identityScope(otherOrg);

    await expectServiceError(
      identityService.getIdentityById({ ...otherScope, identityId: identity.id }),
      'not_found'
    );
    expect(
      await firstPage(
        await identityService.listIdentities({ ...otherScope, ids: [identity.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await identityService.listIdentities({ ...otherScope, actorIds: [identity.actor.id] })
      )
    ).toEqual([]);

    await expect(
      identityService.createIdentity({
        ...otherScope,
        actor: identity.actor,
        input: { name: uniqueId('hijacked'), inputs: [] }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      identityService.updateIdentity({
        ...otherScope,
        identity,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(identityService.archiveIdentity({ ...otherScope, identity })).rejects.toThrow(
      'Tenant mismatch'
    );

    expect(
      await subspaceDb.identity.findUniqueOrThrow({ where: { id: identity.id } })
    ).toMatchObject({ name: identity.name, status: 'active' });
  });

  describe('credentials', () => {
    let server = useMcpTestServer();
    let provider = useRemoteProvider(org, server);
    let foreignProvider = useRemoteProvider(otherOrg, server);

    it('creates an identity with a provider credential and finds it by provider', async () => {
      let scope = await identityScope(org);
      let credentialEvents: string[] = [];
      cleanups.push(
        Fabric.listen('identity.credential.created:after', async event => {
          credentialEvents.push(event.identityCredential.id);
        })
      );

      let identity = await createIdentity(org, {
        inputs: [{ deploymentId: provider.deploymentId, privateMetadata: { token: 'secret' } }]
      });
      expect(identity.credentials).toHaveLength(1);

      let credential = identity.credentials[0]!;
      expect(credential.status).toBe('active');
      expect(credential.provider.id).toBe(provider.providerId);
      expect(credential.deployment?.id).toBe(provider.deploymentId);
      expect(credential.config?.id).toBeTruthy();
      expect(credential.authConfig).toBeNull();
      expect(credential.delegationConfig).toBeNull();
      expect(credentialEvents).toContain(credential.id);

      let row = await subspaceDb.identityCredential.findUniqueOrThrow({
        where: { id: credential.id }
      });
      expect(row).toMatchObject({
        identityOid: identity.oid,
        providerOid: credential.provider.oid,
        privateMetadata: { token: 'secret' }
      });

      for (let filter of [
        { providerIds: [provider.providerId] },
        { providerDeploymentIds: [provider.deploymentId] },
        { providerConfigIds: [credential.config!.id] },
        { identityCredentialIds: [credential.id] }
      ]) {
        let listed = await firstPage(
          await identityService.listIdentities({ ...scope, ids: [identity.id], ...filter })
        );
        expect(listed.map(item => item.id)).toEqual([identity.id]);
      }

      let byForeignProvider = await firstPage(
        await identityService.listIdentities({
          ...scope,
          ids: [identity.id],
          providerIds: [foreignProvider.providerId]
        })
      );
      expect(byForeignProvider).toEqual([]);
    });

    it('adds, reassigns and archives credentials on an existing identity', async () => {
      let scope = await identityScope(org);
      let identity = await createIdentity(org);

      let credential = await identityCredentialService.createIdentityCredential({
        ...scope,
        identity,
        input: { deploymentId: provider.deploymentId }
      });
      expect(credential.identity.id).toBe(identity.id);
      expect(credential.provider.id).toBe(provider.providerId);
      await waitForReconciliation(identity.id);

      let fetched = await identityCredentialService.getIdentityCredentialById({
        ...scope,
        identityCredentialId: credential.id
      });
      expect(fetched.id).toBe(credential.id);

      for (let filter of [
        { identityIds: [identity.id] },
        { actorIds: [identity.actor.id] },
        { providerIds: [provider.providerId] },
        { providerDeploymentIds: [provider.deploymentId] }
      ]) {
        let listed = await firstPage(
          await identityCredentialService.listIdentityCredentials({
            ...scope,
            ids: [credential.id],
            ...filter
          })
        );
        expect(listed.map(item => item.id)).toEqual([credential.id]);
      }

      let delegationConfig =
        await identityDelegationConfigService.createIdentityDelegationConfig({
          ...scope,
          input: { name: uniqueId('config'), subDelegationBehavior: 'allow' }
        });
      let reassigned = await identityCredentialService.updateIdentityCredential({
        ...scope,
        identityCredential: credential,
        input: { delegationConfig }
      });
      expect(reassigned.delegationConfig?.id).toBe(delegationConfig.id);

      let archived = await identityCredentialService.archiveIdentityCredential({
        ...scope,
        identityCredential: reassigned
      });
      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).toBeInstanceOf(Date);

      expect(
        await firstPage(
          await identityCredentialService.listIdentityCredentials({
            ...scope,
            identityIds: [identity.id]
          })
        )
      ).toEqual([]);
      let listedArchived = await firstPage(
        await identityCredentialService.listIdentityCredentials({
          ...scope,
          identityIds: [identity.id],
          status: ['archived']
        })
      );
      expect(listedArchived.map(item => item.id)).toEqual([credential.id]);

      await expectServiceError(
        identityCredentialService.archiveIdentityCredential({
          ...scope,
          identityCredential: archived
        }),
        'gone'
      );
      await expectServiceError(
        identityCredentialService.updateIdentityCredential({
          ...scope,
          identityCredential: archived,
          input: { delegationConfig }
        }),
        'gone'
      );
    });

    it('rejects credentials for archived identities and invalid provider or config references', async () => {
      let scope = await identityScope(org);
      let archivedIdentity = await identityService.archiveIdentity({
        ...scope,
        identity: await createIdentity(org)
      });

      await expectServiceError(
        identityCredentialService.createIdentityCredential({
          ...scope,
          identity: archivedIdentity,
          input: { deploymentId: provider.deploymentId }
        }),
        'use_after_delete'
      );

      let archivedConfig =
        await identityDelegationConfigService.archiveIdentityDelegationConfig({
          ...scope,
          identityDelegationConfig:
            await identityDelegationConfigService.createIdentityDelegationConfig({
              ...scope,
              input: { subDelegationBehavior: 'deny' }
            })
        });
      let foreignConfig = await identityDelegationConfigService.createIdentityDelegationConfig(
        {
          ...(await identityScope(otherOrg)),
          input: { subDelegationBehavior: 'deny' }
        }
      );

      let attempts = [
        {
          input: { deploymentId: provider.deploymentId, delegationConfigId: archivedConfig.id }
        },
        {
          input: { deploymentId: provider.deploymentId, delegationConfigId: foreignConfig.id }
        },
        { input: { deploymentId: provider.deploymentId, delegationConfigId: uniqueId('dc') } },
        { input: { deploymentId: foreignProvider.deploymentId } },
        { input: {} }
      ];
      let expectedCodes = [
        'use_after_delete',
        'not_found',
        'not_found',
        'bad_request',
        'bad_request'
      ];

      for (let [index, { input }] of attempts.entries()) {
        let name = uniqueId('rejected-identity');
        await expectServiceError(
          createIdentity(org, { name, inputs: [input] }),
          expectedCodes[index]!
        );
        expect(await subspaceDb.identity.count({ where: { name } })).toBe(0);
      }
    });

    it('does not resolve or list credentials of another tenant', async () => {
      let identity = await createIdentity(org, {
        inputs: [{ deploymentId: provider.deploymentId }]
      });
      let credential = identity.credentials[0]!;
      let otherScope = await identityScope(otherOrg);

      await expectServiceError(
        identityCredentialService.getIdentityCredentialById({
          ...otherScope,
          identityCredentialId: credential.id
        }),
        'not_found'
      );
      expect(
        await firstPage(
          await identityCredentialService.listIdentityCredentials({
            ...otherScope,
            ids: [credential.id]
          })
        )
      ).toEqual([]);
      await expect(
        identityCredentialService.createIdentityCredential({
          ...otherScope,
          identity,
          input: { deploymentId: foreignProvider.deploymentId }
        })
      ).rejects.toThrow('Tenant mismatch');
    });

    it('archives the credentials of an archived identity in the worker', async () => {
      let scope = await identityScope(org);
      let identity = await createIdentity(org, {
        inputs: [{ deploymentId: provider.deploymentId }]
      });
      let credential = identity.credentials[0]!;
      await identityService.archiveIdentity({ ...scope, identity });

      await eventually(
        async () => {
          let row = await subspaceDb.identityCredential.findUniqueOrThrow({
            where: { id: credential.id }
          });
          expect(row.status).toBe('archived');
        },
        { timeoutMs: 15_000, intervalMs: 500 }
      );

      let listedArchived = await firstPage(
        await identityCredentialService.listIdentityCredentials({
          ...scope,
          identityIds: [identity.id],
          status: ['archived']
        })
      );
      expect(listedArchived.map(item => item.id)).toEqual([credential.id]);
    });
  });
});
