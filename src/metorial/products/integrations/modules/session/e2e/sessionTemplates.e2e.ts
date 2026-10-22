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
  sessionProviderService,
  sessionService,
  sessionTemplateProviderService,
  sessionTemplateService
} from '../src';
import {
  createDeployment,
  onlyAddFilter,
  onlyEchoFilter,
  sessionScope,
  useRemoteProviders
} from './_fixtures';

describe('module-session session templates with providers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useRemoteProviders({ org, otherOrg, server });

  let createTemplate = async (
    providerInputs: SessionProviderInput[],
    name = uniqueId('template')
  ) => {
    let scope = await sessionScope(org);
    let template = await sessionTemplateService.createSessionTemplate({
      ...scope,
      input: { name, providers: providerInputs }
    });

    return { scope, template };
  };

  let createSession = async (providerInputs: SessionProviderInput[]) => {
    let scope = await sessionScope(org);
    return await sessionService.createSession({
      ...scope,
      input: { name: uniqueId('session'), providers: providerInputs }
    });
  };

  let templateHash = async (templateId: string) =>
    (await subspaceDb.sessionTemplate.findUniqueOrThrow({ where: { id: templateId } })).hash;

  it('creates a template with several providers', async () => {
    let [firstDeployment, secondDeployment] = await Promise.all([
      createDeployment(org, providers.first),
      createDeployment(org, providers.second)
    ]);

    let { scope, template } = await createTemplate([
      { deploymentId: firstDeployment },
      { deploymentId: secondDeployment, toolFilters: onlyEchoFilter }
    ]);
    expect(template.status).toBe('active');
    expect(template.providers).toHaveLength(2);

    let rows = await subspaceDb.sessionTemplateProvider.findMany({
      where: { sessionTemplateOid: template.oid },
      include: { deployment: true, provider: true }
    });
    let byDeployment = new Map(rows.map(row => [row.deployment.id, row]));
    expect(byDeployment.get(firstDeployment)).toMatchObject({
      status: 'active',
      toolFilter: { type: 'v1.allow_all' },
      tenantOid: template.tenantOid
    });
    expect(byDeployment.get(firstDeployment)!.provider.id).toBe(providers.first);
    expect(byDeployment.get(secondDeployment)!.toolFilter).toEqual(onlyEchoFilter);
    expect(byDeployment.get(secondDeployment)!.provider.id).toBe(providers.second);

    let templateProviders = await firstPage(
      await sessionTemplateProviderService.listSessionTemplateProviders({
        ...scope,
        sessionTemplateIds: [template.id]
      })
    );
    expect(templateProviders.map(item => item.id).sort()).toEqual(
      template.providers.map(item => item.id).sort()
    );

    let byProvider = await firstPage(
      await sessionTemplateService.listSessionTemplates({
        ...scope,
        ids: [template.id],
        providerIds: [providers.second]
      })
    );
    expect(byProvider.map(item => item.id)).toEqual([template.id]);

    let byDeploymentFilter = await firstPage(
      await sessionTemplateService.listSessionTemplates({
        ...scope,
        providerDeploymentIds: [firstDeployment]
      })
    );
    expect(byDeploymentFilter.map(item => item.id)).toEqual([template.id]);
  });

  it('syncs the template hash and provider usage', async () => {
    let deploymentId = await createDeployment(org, providers.second);
    let { template } = await createTemplate([{ deploymentId }]);

    await eventually(async () => {
      expect(await templateHash(template.id)).toMatch(/\S/);

      let use = await subspaceDb.providerUse.findFirstOrThrow({
        where: { tenantOid: template.tenantOid, provider: { id: providers.second } }
      });
      expect(use.sessionTemplates).toBeGreaterThanOrEqual(1);
      expect(use.lastSessionTemplateAt).toBeInstanceOf(Date);
    });
  });

  it('adds, updates and archives template providers', async () => {
    let [firstDeployment, secondDeployment] = await Promise.all([
      createDeployment(org, providers.first),
      createDeployment(org, providers.second)
    ]);
    let { scope, template } = await createTemplate([{ deploymentId: firstDeployment }]);

    let added = await sessionTemplateProviderService.createSessionTemplateProvider({
      ...scope,
      template,
      input: { deploymentId: secondDeployment, toolFilters: onlyAddFilter }
    });
    expect(added).toMatchObject({ status: 'active', toolFilter: onlyAddFilter });
    expect(added.provider.id).toBe(providers.second);

    let withAdded = await sessionTemplateService.getSessionTemplateById({
      ...scope,
      sessionTemplateId: template.id
    });
    expect(withAdded.providers).toHaveLength(2);

    let updated = await sessionTemplateProviderService.updateSessionTemplateProvider({
      ...scope,
      sessionTemplateProvider: added,
      input: { toolFilters: onlyEchoFilter }
    });
    expect(updated.toolFilter).toEqual(onlyEchoFilter);
    expect(
      (await subspaceDb.sessionTemplateProvider.findUniqueOrThrow({ where: { id: added.id } }))
        .toolFilter
    ).toEqual(onlyEchoFilter);

    let archived = await sessionTemplateProviderService.archiveSessionTemplateProvider({
      ...scope,
      sessionTemplateProvider: updated
    });
    expect(archived.status).toBe('archived');

    let afterArchive = await sessionTemplateService.getSessionTemplateById({
      ...scope,
      sessionTemplateId: template.id
    });
    expect(afterArchive.providers.map(item => item.deployment.id)).toEqual([firstDeployment]);

    let templateProviders = await firstPage(
      await sessionTemplateProviderService.listSessionTemplateProviders({
        ...scope,
        sessionTemplateIds: [template.id]
      })
    );
    expect(templateProviders.map(item => item.deployment.id)).toEqual([firstDeployment]);

    await expectServiceError(
      sessionTemplateProviderService.archiveSessionTemplateProvider({
        ...scope,
        sessionTemplateProvider: archived
      }),
      'gone'
    );
  });

  it("creates sessions from a template with the template's providers and tool filters", async () => {
    let [firstDeployment, secondDeployment, extraDeployment] = await Promise.all([
      createDeployment(org, providers.first),
      createDeployment(org, providers.second),
      createDeployment(org, providers.second)
    ]);
    let { scope, template } = await createTemplate([
      { deploymentId: firstDeployment },
      { deploymentId: secondDeployment, toolFilters: onlyEchoFilter }
    ]);
    let templateProviderByDeployment = new Map(
      template.providers.map(item => [item.deployment.id, item])
    );

    let fromTemplate = await createSession([{ sessionTemplateId: template.id }]);
    expect(fromTemplate.providers).toHaveLength(2);
    for (let sessionProvider of fromTemplate.providers) {
      let templateProvider = templateProviderByDeployment.get(sessionProvider.deployment.id)!;
      expect(sessionProvider.fromTemplate?.id).toBe(template.id);
      expect(sessionProvider.fromTemplateProvider?.id).toBe(templateProvider.id);
      expect(sessionProvider.toolFilter).toEqual(templateProvider.toolFilter);
    }

    let rows = await subspaceDb.sessionProvider.findMany({
      where: { session: { id: fromTemplate.id } }
    });
    expect(rows.map(row => row.fromTemplateOid)).toEqual([template.oid, template.oid]);

    let overridden = await createSession([
      { sessionTemplateId: template.id, toolFilters: onlyAddFilter }
    ]);
    expect(overridden.providers.map(item => item.toolFilter)).toEqual([
      onlyAddFilter,
      onlyAddFilter
    ]);

    let combined = await createSession([
      { sessionTemplateId: template.id },
      { deploymentId: extraDeployment }
    ]);
    expect(combined.providers).toHaveLength(3);
    let extra = combined.providers.find(item => item.deployment.id === extraDeployment)!;
    expect(extra.fromTemplate).toBeNull();

    let plain = await createSession([{ deploymentId: firstDeployment }]);
    let ids = [fromTemplate.id, overridden.id, combined.id, plain.id];

    let fromTemplateIds = await firstPage(
      await sessionService.listSessions({ ...scope, ids, sessionTemplateIds: [template.id] })
    );
    expect(fromTemplateIds.map(item => item.id).sort()).toEqual(
      [fromTemplate.id, overridden.id, combined.id].sort()
    );

    let combinedTemplateProviders = await firstPage(
      await sessionProviderService.listSessionProviders({
        ...scope,
        sessionIds: [combined.id],
        sessionTemplateIds: [template.id]
      })
    );
    expect(combinedTemplateProviders).toHaveLength(2);
    expect(combinedTemplateProviders.map(item => item.id)).not.toContain(extra.id);

    let listTemplateIds = async (
      filters: Parameters<typeof sessionTemplateService.listSessionTemplates>[0]
    ) =>
      (await firstPage(await sessionTemplateService.listSessionTemplates(filters))).map(
        item => item.id
      );

    expect(await listTemplateIds({ ...scope, sessionIds: [fromTemplate.id] })).toEqual([
      template.id
    ]);
    expect(await listTemplateIds({ ...scope, sessionIds: [plain.id] })).toEqual([]);
    expect(
      await listTemplateIds({ ...scope, sessionProviderIds: [fromTemplate.providers[0]!.id] })
    ).toEqual([template.id]);
    expect(
      await listTemplateIds({ ...scope, sessionProviderIds: [plain.providers[0]!.id] })
    ).toEqual([]);
  });

  it('archives a template and its providers without touching unrelated sessions', async () => {
    let deploymentId = await createDeployment(org, providers.first);
    let { scope, template } = await createTemplate([{ deploymentId }]);
    let plain = await createSession([{ deploymentId }]);

    let archived = await sessionTemplateService.archiveSessionTemplate({
      ...scope,
      sessionTemplate: template
    });
    expect(archived.status).toBe('archived');
    expect(archived.providers).toEqual([]);

    let templateProviderRows = await subspaceDb.sessionTemplateProvider.findMany({
      where: { sessionTemplateOid: template.oid }
    });
    expect(templateProviderRows.map(row => row.status)).toEqual(['archived']);

    let plainRow = await subspaceDb.session.findUniqueOrThrow({
      where: { id: plain.id },
      include: { providers: true }
    });
    expect(plainRow.status).toBe('active');
    expect(plainRow.providers.map(item => item.status)).toEqual(['active']);

    let fetched = await sessionTemplateService.getSessionTemplateById({
      ...scope,
      sessionTemplateId: template.id
    });
    expect(fetched.status).toBe('archived');

    expect(
      await firstPage(
        await sessionTemplateService.listSessionTemplates({ ...scope, ids: [template.id] })
      )
    ).toEqual([]);

    await expectServiceError(createSession([{ sessionTemplateId: template.id }]), 'not_found');
    await expectServiceError(
      sessionTemplateService.archiveSessionTemplate({ ...scope, sessionTemplate: archived }),
      'gone'
    );
    await expectServiceError(
      sessionTemplateService.updateSessionTemplate({
        ...scope,
        template: archived,
        input: { name: 'renamed' }
      }),
      'gone'
    );
    await expectServiceError(
      sessionTemplateProviderService.createSessionTemplateProvider({
        ...scope,
        template: archived,
        input: { deploymentId }
      }),
      'use_after_delete'
    );
  });

  it('archives the sessions created from a template when the template is archived', async () => {
    let deploymentId = await createDeployment(org, providers.first);
    let { scope, template } = await createTemplate([{ deploymentId }]);
    let fromTemplate = await createSession([{ sessionTemplateId: template.id }]);
    let combined = await createSession([{ sessionTemplateId: template.id }, { deploymentId }]);

    await sessionTemplateService.archiveSessionTemplate({
      ...scope,
      sessionTemplate: template
    });

    await eventually(async () => {
      let sessions = await subspaceDb.session.findMany({
        where: { id: { in: [fromTemplate.id, combined.id] } },
        include: { providers: true }
      });
      expect(sessions).toHaveLength(2);
      for (let session of sessions) {
        expect(session.status).toBe('archived');
        expect(session.archivedAt).toBeInstanceOf(Date);
        expect(session.connectionState).toBe('disconnected');
        expect(session.providers.every(item => item.status === 'archived')).toBe(true);
      }
    });

    expect(
      await firstPage(
        await sessionService.listSessions({ ...scope, sessionTemplateIds: [template.id] })
      )
    ).toEqual([]);
  });

  it('rejects invalid template providers without persisting the template', async () => {
    let foreignDeployment = await createDeployment(otherOrg, providers.foreign);
    let name = uniqueId('invalid-template');

    await expectServiceError(createTemplate([{}], name), 'bad_request');
    await expectServiceError(
      createTemplate([{ deploymentId: uniqueId('pdp') }], name),
      'bad_request'
    );
    await expectServiceError(
      createTemplate([{ deploymentId: foreignDeployment }], name),
      'bad_request'
    );
    expect(await subspaceDb.sessionTemplate.count({ where: { name } })).toBe(0);

    let { scope, template } = await createTemplate([]);
    await expectServiceError(
      sessionTemplateProviderService.createSessionTemplateProvider({
        ...scope,
        template,
        input: {}
      }),
      'bad_request'
    );
    expect(
      await subspaceDb.sessionTemplateProvider.count({
        where: { sessionTemplateOid: template.oid }
      })
    ).toBe(0);
  });

  it("does not expose or change another tenant's session templates", async () => {
    let deploymentId = await createDeployment(org, providers.first);
    let { template } = await createTemplate([{ deploymentId }]);
    let templateProvider = template.providers[0]!;
    let other = await sessionScope(otherOrg);
    let foreignDeployment = await createDeployment(otherOrg, providers.foreign);

    await expectServiceError(
      sessionTemplateService.getSessionTemplateById({
        ...other,
        sessionTemplateId: template.id
      }),
      'not_found'
    );
    await expectServiceError(
      sessionTemplateProviderService.getSessionTemplateProviderById({
        ...other,
        sessionTemplateProviderId: templateProvider.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await sessionTemplateService.listSessionTemplates({ ...other, ids: [template.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await sessionTemplateProviderService.listSessionTemplateProviders({
          ...other,
          sessionTemplateIds: [template.id]
        })
      )
    ).toEqual([]);

    await expectServiceError(
      sessionService.createSession({
        ...other,
        input: { providers: [{ sessionTemplateId: template.id }] }
      }),
      'not_found'
    );

    await expect(
      sessionTemplateService.updateSessionTemplate({
        ...other,
        template,
        input: { name: 'hijacked' }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      sessionTemplateService.archiveSessionTemplate({ ...other, sessionTemplate: template })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      sessionTemplateProviderService.archiveSessionTemplateProvider({
        ...other,
        sessionTemplateProvider: templateProvider
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      sessionTemplateProviderService.createSessionTemplateProvider({
        ...other,
        template,
        input: { deploymentId: foreignDeployment }
      })
    ).rejects.toThrow('Tenant mismatch');

    let row = await subspaceDb.sessionTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: { providers: true }
    });
    expect(row.name).toBe(template.name);
    expect(row.status).toBe('active');
    expect(row.providers.map(item => [item.id, item.status])).toEqual([
      [templateProvider.id, 'active']
    ]);
  });
});
