import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  type SessionProviderInput,
  sessionEventService,
  sessionProviderService,
  sessionService
} from '../src';
import {
  archiveDeployment,
  createDeployment,
  onlyAddFilter,
  onlyEchoFilter,
  pageAll,
  sessionScope,
  useRemoteProviders
} from './_fixtures';

describe('module-session sessions with providers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useRemoteProviders({ org, otherOrg, server });

  let createSession = async (
    providerInputs: SessionProviderInput[],
    name = uniqueId('session')
  ) => {
    let scope = await sessionScope(org);
    let session = await sessionService.createSession({
      ...scope,
      input: { name, metadata: { e2e: true }, providers: providerInputs }
    });

    return { scope, session };
  };

  let sessionWithDeployments = (deploymentIds: string[]) =>
    createSession(deploymentIds.map(deploymentId => ({ deploymentId })));

  it('creates a session with one provider and persists the resolved combination', async () => {
    let deploymentId = await createDeployment(org, providers.first);
    let { scope, session } = await sessionWithDeployments([deploymentId]);

    expect(session.status).toBe('active');
    expect(session.providers).toHaveLength(1);

    let sessionProvider = session.providers[0]!;
    expect(sessionProvider.status).toBe('active');
    expect(sessionProvider.provider.id).toBe(providers.first);
    expect(sessionProvider.deployment.id).toBe(deploymentId);
    expect(sessionProvider.config.id).toBeTruthy();
    expect(sessionProvider.toolFilter).toEqual({ type: 'v1.allow_all' });

    let sessionRow = await subspaceDb.session.findUniqueOrThrow({ where: { id: session.id } });
    let row = await subspaceDb.sessionProvider.findUniqueOrThrow({
      where: { id: sessionProvider.id },
      include: { provider: true, deployment: true, config: true }
    });
    expect(row).toMatchObject({
      status: 'active',
      isEphemeral: false,
      sessionOid: sessionRow.oid,
      tenantOid: sessionRow.tenantOid,
      environmentOid: sessionRow.environmentOid,
      fromTemplateOid: null
    });
    expect(row.provider.id).toBe(providers.first);
    expect(row.deployment.id).toBe(deploymentId);
    expect(row.config.id).toBe(sessionProvider.config.id);

    let fetched = await sessionService.getSessionById({ ...scope, sessionId: session.id });
    expect(fetched.providers.map(item => item.id)).toEqual([sessionProvider.id]);

    let byId = await sessionProviderService.getSessionProviderById({
      ...scope,
      sessionProviderId: sessionProvider.id
    });
    expect(byId.session.id).toBe(session.id);

    let listed = await firstPage(
      await sessionProviderService.listSessionProviders({ ...scope, sessionIds: [session.id] })
    );
    expect(listed.map(item => item.id)).toEqual([sessionProvider.id]);

    let events = await firstPage(
      await sessionEventService.listSessionEvents({ ...scope, sessionIds: [session.id] })
    );
    expect(events.map(event => event.type)).toEqual(['session_created']);
  });

  it('counts sessions in the provider usage', async () => {
    let deploymentId = await createDeployment(org, providers.second);
    let { session } = await sessionWithDeployments([deploymentId]);
    let row = await subspaceDb.sessionProvider.findUniqueOrThrow({
      where: { id: session.providers[0]!.id }
    });

    await eventually(async () => {
      let use = await subspaceDb.providerUse.findFirstOrThrow({
        where: { tenantOid: row.tenantOid, providerOid: row.providerOid }
      });
      expect(use.sessions).toBeGreaterThanOrEqual(1);
      expect(use.lastSessionAt).toBeInstanceOf(Date);
    });
  });

  it('creates a session with several providers, each with its own tag and tool filter', async () => {
    let [firstDeployment, secondDeployment, extraDeployment] = await Promise.all([
      createDeployment(org, providers.first),
      createDeployment(org, providers.second),
      createDeployment(org, providers.first)
    ]);

    let { session } = await createSession([
      { deploymentId: firstDeployment },
      { deploymentId: secondDeployment, toolFilters: onlyEchoFilter },
      { deploymentId: extraDeployment }
    ]);
    expect(session.providers).toHaveLength(3);

    let byDeployment = new Map(session.providers.map(item => [item.deployment.id, item]));
    expect(byDeployment.get(firstDeployment)!.provider.id).toBe(providers.first);
    expect(byDeployment.get(secondDeployment)!.provider.id).toBe(providers.second);
    expect(byDeployment.get(extraDeployment)!.provider.id).toBe(providers.first);
    expect(new Set(session.providers.map(item => item.tag)).size).toBe(3);

    let rows = await subspaceDb.sessionProvider.findMany({
      where: { session: { id: session.id } },
      include: { deployment: true }
    });
    let rowFilters = Object.fromEntries(rows.map(row => [row.deployment.id, row.toolFilter]));
    expect(rowFilters).toEqual({
      [firstDeployment]: { type: 'v1.allow_all' },
      [secondDeployment]: onlyEchoFilter,
      [extraDeployment]: { type: 'v1.allow_all' }
    });
  });

  it('adds, updates and archives providers on an existing session', async () => {
    let deploymentId = await createDeployment(org, providers.second);
    let { scope, session } = await createSession([]);
    expect(session.providers).toEqual([]);

    let added = await sessionProviderService.createSessionProvider({
      ...scope,
      session,
      input: { deploymentId }
    });
    expect(added).toMatchObject({ status: 'active', toolFilter: { type: 'v1.allow_all' } });
    expect(added.provider.id).toBe(providers.second);

    let withProvider = await sessionService.getSessionById({
      ...scope,
      sessionId: session.id
    });
    expect(withProvider.providers.map(item => item.id)).toEqual([added.id]);

    let updated = await sessionProviderService.updateSessionProvider({
      ...scope,
      sessionProvider: added,
      input: { toolFilters: onlyAddFilter }
    });
    expect(updated.toolFilter).toEqual(onlyAddFilter);

    let archived = await sessionProviderService.archiveSessionProvider({
      ...scope,
      sessionProvider: updated
    });
    expect(archived.status).toBe('archived');
    expect(
      (await subspaceDb.sessionProvider.findUniqueOrThrow({ where: { id: added.id } })).status
    ).toBe('archived');

    let afterArchive = await sessionService.getSessionById({
      ...scope,
      sessionId: session.id
    });
    expect(afterArchive.providers).toEqual([]);
    expect(afterArchive.status).toBe('active');

    let activeProviders = await firstPage(
      await sessionProviderService.listSessionProviders({ ...scope, sessionIds: [session.id] })
    );
    expect(activeProviders).toEqual([]);

    let archivedProviders = await firstPage(
      await sessionProviderService.listSessionProviders({
        ...scope,
        sessionIds: [session.id],
        status: ['archived']
      })
    );
    expect(archivedProviders.map(item => item.id)).toEqual([added.id]);

    await expectServiceError(
      sessionProviderService.archiveSessionProvider({ ...scope, sessionProvider: archived }),
      'gone'
    );
    await expectServiceError(
      sessionProviderService.updateSessionProvider({
        ...scope,
        sessionProvider: archived,
        input: { toolFilters: onlyEchoFilter }
      }),
      'gone'
    );
  });

  it('archives the providers of an archived session and rejects further changes', async () => {
    let deployments = await Promise.all([
      createDeployment(org, providers.first),
      createDeployment(org, providers.second)
    ]);
    let { scope, session } = await sessionWithDeployments(deployments);
    let [createdEvent] = await firstPage(
      await sessionEventService.listSessionEvents({ ...scope, sessionIds: [session.id] })
    );
    expect(createdEvent?.type).toBe('session_created');

    let archived = await sessionService.archiveSession({ ...scope, session });
    expect(archived.status).toBe('archived');
    expect(archived.providers).toEqual([]);

    let sessionRow = await subspaceDb.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(sessionRow).toMatchObject({ status: 'archived', connectionState: 'disconnected' });
    expect(sessionRow.archivedAt).toBeInstanceOf(Date);

    let providerRows = await subspaceDb.sessionProvider.findMany({
      where: { sessionOid: sessionRow.oid }
    });
    expect(providerRows.map(row => row.status)).toEqual(['archived', 'archived']);

    await eventually(async () => {
      let rows = await subspaceDb.sessionProvider.findMany({
        where: { sessionOid: sessionRow.oid }
      });
      expect(rows.every(row => row.isParentDeleted)).toBe(true);
    });

    await eventually(async () => {
      let visible = await firstPage(
        await sessionEventService.listSessionEvents({ ...scope, sessionIds: [session.id] })
      );
      expect(visible).toEqual([]);
    });

    let deletedEvent = await sessionEventService.getSessionEventById({
      ...scope,
      sessionEventId: createdEvent!.id,
      allowDeleted: true
    });
    expect(deletedEvent.type).toBe('session_created');

    let activeList = await firstPage(
      await sessionService.listSessions({ ...scope, ids: [session.id] })
    );
    expect(activeList).toEqual([]);

    let archivedList = await firstPage(
      await sessionService.listSessions({ ...scope, ids: [session.id], status: ['archived'] })
    );
    expect(archivedList.map(item => item.id)).toEqual([session.id]);

    let deploymentId = await createDeployment(org, providers.first);
    await expectServiceError(
      sessionProviderService.createSessionProvider({
        ...scope,
        session: archived,
        input: { deploymentId }
      }),
      'use_after_delete'
    );
    await expectServiceError(
      sessionService.updateSession({
        ...scope,
        session: archived,
        input: { name: 'renamed' }
      }),
      'gone'
    );
    await expectServiceError(
      sessionService.archiveSession({ ...scope, session: archived }),
      'gone'
    );
  });

  it.fails(
    'lists the events of an archived session with allowDeleted (bug: list-utils normalizeStatusForList ignores allowDeleted when no status filter is given)',
    async () => {
      let deploymentId = await createDeployment(org, providers.first);
      let { scope, session } = await sessionWithDeployments([deploymentId]);
      let sessionRow = await subspaceDb.session.findUniqueOrThrow({
        where: { id: session.id }
      });

      await sessionService.archiveSession({ ...scope, session });
      await eventually(async () => {
        let rows = await subspaceDb.sessionEvent.findMany({
          where: { sessionOid: sessionRow.oid }
        });
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.every(row => row.isParentDeleted)).toBe(true);
      });

      let withDeleted = await firstPage(
        await sessionEventService.listSessionEvents({
          ...scope,
          sessionIds: [session.id],
          allowDeleted: true
        })
      );
      expect(withDeleted.map(event => event.type)).toContain('session_created');
    }
  );

  it('filters sessions and session providers by provider, deployment, config and session provider', async () => {
    let [firstDeployment, secondDeployment] = await Promise.all([
      createDeployment(org, providers.first),
      createDeployment(org, providers.second)
    ]);
    let { scope, session: first } = await sessionWithDeployments([firstDeployment]);
    let { session: second } = await sessionWithDeployments([secondDeployment]);
    let { session: empty } = await createSession([]);

    let ids = [first.id, second.id, empty.id];
    let firstProvider = first.providers[0]!;
    let secondProvider = second.providers[0]!;

    let listIds = async (filters: Parameters<typeof sessionService.listSessions>[0]) =>
      (await firstPage(await sessionService.listSessions(filters)))
        .map(item => item.id)
        .sort();

    expect(await listIds({ ...scope, ids })).toEqual([...ids].sort());
    expect(await listIds({ ...scope, ids, providerIds: [providers.first] })).toEqual([
      first.id
    ]);
    expect(
      await listIds({ ...scope, ids, providerDeploymentIds: [secondDeployment] })
    ).toEqual([second.id]);
    expect(
      await listIds({ ...scope, ids, providerConfigIds: [firstProvider.config.id] })
    ).toEqual([first.id]);
    expect(await listIds({ ...scope, ids, sessionProviderIds: [secondProvider.id] })).toEqual([
      second.id
    ]);
    expect(await listIds({ ...scope, ids, sessionProviderIds: [] })).toEqual([]);
    expect(await listIds({ ...scope, ids, providerIds: [uniqueId('pro')] })).toEqual([]);

    let providerIds = async (
      filters: Parameters<typeof sessionProviderService.listSessionProviders>[0]
    ) =>
      (await firstPage(await sessionProviderService.listSessionProviders(filters)))
        .map(item => item.id)
        .sort();

    expect(await providerIds({ ...scope, sessionIds: ids })).toEqual(
      [firstProvider.id, secondProvider.id].sort()
    );
    expect(
      await providerIds({ ...scope, sessionIds: ids, providerIds: [providers.second] })
    ).toEqual([secondProvider.id]);
    expect(
      await providerIds({
        ...scope,
        sessionIds: ids,
        providerDeploymentIds: [firstDeployment]
      })
    ).toEqual([firstProvider.id]);
    expect(
      await providerIds({ ...scope, ids: [firstProvider.id, secondProvider.id] })
    ).toEqual([firstProvider.id, secondProvider.id].sort());
  });

  it('pages through sessions and session providers one at a time without duplicates', async () => {
    let deploymentId = await createDeployment(org, providers.first);
    let sessions = await Promise.all([
      sessionWithDeployments([deploymentId]),
      sessionWithDeployments([deploymentId]),
      sessionWithDeployments([deploymentId])
    ]);
    let scope = sessions[0]!.scope;
    let ids = sessions.map(item => item.session.id);

    let paged = await pageAll(await sessionService.listSessions({ ...scope, ids }));
    expect(paged.map(item => item.id).sort()).toEqual([...ids].sort());

    let pagedProviders = await pageAll(
      await sessionProviderService.listSessionProviders({
        ...scope,
        providerDeploymentIds: [deploymentId]
      })
    );
    expect(pagedProviders.map(item => item.id).sort()).toEqual(
      sessions.map(item => item.session.providers[0]!.id).sort()
    );
  });

  it('rejects provider input without a deployment, config or auth config', async () => {
    let name = uniqueId('invalid');

    await expectServiceError(createSession([{}], name), 'bad_request');
    expect(await subspaceDb.session.count({ where: { name } })).toBe(0);
  });

  it('rejects more than 100 providers per session', async () => {
    let deploymentId = await createDeployment(org, providers.first);
    let name = uniqueId('too-many');

    let data = await expectServiceError(
      createSession(
        Array.from({ length: 101 }, () => ({ deploymentId })),
        name
      ),
      'bad_request'
    );
    expect(data.message).toContain('100');
    expect(await subspaceDb.session.count({ where: { name } })).toBe(0);
  });

  it('rejects unknown and foreign deployments without creating a session', async () => {
    let foreignDeployment = await createDeployment(otherOrg, providers.foreign);
    let name = uniqueId('bad-deployment');

    await expectServiceError(
      createSession([{ deploymentId: uniqueId('pdp') }], name),
      'bad_request'
    );
    await expectServiceError(
      createSession([{ deploymentId: foreignDeployment }], name),
      'bad_request'
    );
    await expectServiceError(
      createSession([{ configId: uniqueId('pcfg') }], name),
      'bad_request'
    );
    expect(await subspaceDb.session.count({ where: { name } })).toBe(0);
  });

  it.fails(
    'rejects an unknown deployment as not_found (bug: providerCombinationService reports a missing-input bad_request instead)',
    async () => {
      await expectServiceError(
        createSession([{ deploymentId: uniqueId('pdp') }]),
        'not_found'
      );
    }
  );

  it('rejects an unknown session template', async () => {
    await expectServiceError(
      createSession([{ sessionTemplateId: uniqueId('sest') }]),
      'not_found'
    );
  });

  it("rejects combining one provider's config with another provider's deployment", async () => {
    let [firstDeployment, secondDeployment] = await Promise.all([
      createDeployment(org, providers.first),
      createDeployment(org, providers.second)
    ]);
    let { session } = await sessionWithDeployments([secondDeployment]);
    let foreignConfigId = session.providers[0]!.config.id;
    let name = uniqueId('mismatch');

    let data = await expectServiceError(
      createSession([{ deploymentId: firstDeployment, configId: foreignConfigId }], name),
      'bad_request'
    );
    expect(data.message).toMatch(/mismatched providers/);
    expect(await subspaceDb.session.count({ where: { name } })).toBe(0);
  });

  it('rejects archived deployments', async () => {
    let deploymentId = await createDeployment(org, providers.first);
    await archiveDeployment(org, deploymentId);

    await expectServiceError(createSession([{ deploymentId }]), 'use_after_delete');

    let { scope, session } = await createSession([]);
    await expectServiceError(
      sessionProviderService.createSessionProvider({
        ...scope,
        session,
        input: { deploymentId }
      }),
      'use_after_delete'
    );
  });

  it("does not expose or change another tenant's sessions and session providers", async () => {
    let deploymentId = await createDeployment(org, providers.first);
    let { session } = await sessionWithDeployments([deploymentId]);
    let sessionProvider = session.providers[0]!;
    let other = await sessionScope(otherOrg);
    let foreignDeployment = await createDeployment(otherOrg, providers.foreign);

    await expectServiceError(
      sessionService.getSessionById({ ...other, sessionId: session.id }),
      'not_found'
    );
    await expectServiceError(
      sessionProviderService.getSessionProviderById({
        ...other,
        sessionProviderId: sessionProvider.id
      }),
      'not_found'
    );

    expect(
      await firstPage(await sessionService.listSessions({ ...other, ids: [session.id] }))
    ).toEqual([]);
    expect(
      await firstPage(
        await sessionService.listSessions({ ...other, providerDeploymentIds: [deploymentId] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await sessionProviderService.listSessionProviders({
          ...other,
          sessionIds: [session.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await sessionEventService.listSessionEvents({ ...other, sessionIds: [session.id] })
      )
    ).toEqual([]);

    await expect(
      sessionService.updateSession({ ...other, session, input: { name: 'hijacked' } })
    ).rejects.toThrow('Tenant mismatch');
    await expect(sessionService.archiveSession({ ...other, session })).rejects.toThrow(
      'Tenant mismatch'
    );
    await expect(
      sessionProviderService.archiveSessionProvider({ ...other, sessionProvider })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      sessionProviderService.createSessionProvider({
        ...other,
        session,
        input: { deploymentId: foreignDeployment }
      })
    ).rejects.toThrow('Tenant mismatch');

    await expectServiceError(
      createSession([{ deploymentId: foreignDeployment }]),
      'bad_request'
    );

    let row = await subspaceDb.session.findUniqueOrThrow({
      where: { id: session.id },
      include: { providers: true }
    });
    expect(row.name).toBe(session.name);
    expect(row.status).toBe('active');
    expect(row.providers.map(item => [item.id, item.status])).toEqual([
      [sessionProvider.id, 'active']
    ]);
  });
});
