import {
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { Fabric } from '@metorial/fabric';
import { describe, expect, it, onTestFinished } from 'vitest';
import { keyProviderService } from '../src';

let load = (org: BootstrappedOrganization) => loadOrganizationFixture(org.ids);

let listKeyProviders = async (fixture: OrganizationFixture) =>
  firstPage(
    await keyProviderService.listKeyProviders({
      organization: fixture.organization,
      project: fixture.project
    })
  );

let defaultIds = async (fixture: OrganizationFixture) =>
  (await listKeyProviders(fixture)).filter(item => item.isDefault).map(item => item.id);

let createManaged = (fixture: OrganizationFixture, name = uniqueId('managed-kp')) =>
  keyProviderService.createManagedKeyProvider({
    organization: fixture.organization,
    project: fixture.project,
    performedBy: fixture.actor,
    context: fixture.context,
    name
  });

let importKeyProvider = (fixture: OrganizationFixture) =>
  keyProviderService.importKeyProvider({
    organization: fixture.organization,
    project: fixture.project,
    performedBy: fixture.actor,
    context: fixture.context,
    keyInput: { testKeyId: uniqueId('local-key'), environment: 'development' }
  });

let getKeyProvider = (fixture: OrganizationFixture, keyProviderId: string) =>
  keyProviderService.getKeyProvider({
    organization: fixture.organization,
    project: fixture.project,
    keyProviderId
  });

let setDefault = (fixture: OrganizationFixture, keyProviderId: string) =>
  keyProviderService.setDefaultKeyProvider({
    organization: fixture.organization,
    project: fixture.project,
    performedBy: fixture.actor,
    context: fixture.context,
    keyProviderId
  });

let validate = (fixture: OrganizationFixture, keyProviderId: string) =>
  keyProviderService.validateKeyProvider({
    organization: fixture.organization,
    project: fixture.project,
    performedBy: fixture.actor,
    context: fixture.context,
    keyProviderId
  });

let listErrors = async (fixture: OrganizationFixture, keyProviderId: string) =>
  firstPage(
    await keyProviderService.listKeyProviderErrors({
      organization: fixture.organization,
      project: fixture.project,
      keyProviderId
    })
  );

describe('module-secrets key providers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let defaultsOrg = useOrganization();
  let countingOrg = useOrganization();

  it('links every project to its own Nebula tenant exactly once', async () => {
    let fixture = await load(org);
    let other = await load(otherOrg);

    await listKeyProviders(fixture);
    let linked = await db.project.findUniqueOrThrow({ where: { oid: fixture.project.oid } });
    expect(linked.nebulaTenantId).toBeTruthy();
    expect(linked.internalTenantIdentifier).toBe(`mte-pro-${fixture.project.oid}`);

    await listKeyProviders({ ...fixture, project: linked });
    await listKeyProviders(fixture);
    let relinked = await db.project.findUniqueOrThrow({ where: { oid: fixture.project.oid } });
    expect(relinked.nebulaTenantId).toBe(linked.nebulaTenantId);

    await listKeyProviders(other);
    let otherProject = await db.project.findUniqueOrThrow({
      where: { oid: other.project.oid }
    });
    expect(otherProject.nebulaTenantId).toBeTruthy();
    expect(otherProject.nebulaTenantId).not.toBe(linked.nebulaTenantId);
  });

  it('creates Metorial-managed providers without exposing their key material', async () => {
    let fixture = await load(org);
    let name = uniqueId('managed-kp');

    let created = await createManaged(fixture, name);
    expect(created).toMatchObject({
      object: 'nebula#key_provider',
      name,
      type: 'local',
      owner: 'system',
      status: 'active',
      isMetorialManaged: true
    });
    expect(created.keyInfo).not.toHaveProperty('secret');

    let fetched = await getKeyProvider(fixture, created.id);
    expect(fetched).toMatchObject({ id: created.id, name, isMetorialManaged: true });
    expect(fetched.keyInfo).not.toHaveProperty('secret');

    let listed = await listKeyProviders(fixture);
    expect(listed.filter(item => item.id === created.id)).toHaveLength(1);
  });

  it('defaults a fresh tenant to the global provider until it gets its own', async () => {
    let fixture = await load(defaultsOrg);

    let initial = await listKeyProviders(fixture);
    let initialDefaults = initial.filter(item => item.isDefault);
    expect(initialDefaults).toHaveLength(1);
    expect(initialDefaults[0]!.owner).toBe('system');

    let first = await createManaged(fixture);
    expect(first.isDefault).toBe(true);
    expect(await defaultIds(fixture)).toEqual([first.id]);

    let second = await createManaged(fixture);
    let imported = await importKeyProvider(fixture);
    expect(second.isDefault).toBe(false);
    expect(imported.isDefault).toBe(false);
    expect(await defaultIds(fixture)).toEqual([first.id]);

    let switched = await setDefault(fixture, second.id);
    expect(switched).toMatchObject({ id: second.id, isDefault: true });
    expect((await getKeyProvider(fixture, first.id)).isDefault).toBe(false);
    expect(await defaultIds(fixture)).toEqual([second.id]);

    await setDefault(fixture, imported.id);
    expect(await defaultIds(fixture)).toEqual([imported.id]);
  });

  it('imports a tenant-owned provider that can be validated and has no errors', async () => {
    let fixture = await load(org);
    let validations: { keyProviderId: string; validationFor: string }[] = [];

    onTestFinished(
      Fabric.listen('key_provider.validated:after', event => {
        if (event.organization.id === fixture.organization.id) {
          validations.push({
            keyProviderId: event.keyProvider.id,
            validationFor: event.validation.keyProviderId
          });
        }
      })
    );

    let imported = await importKeyProvider(fixture);
    expect(imported).toMatchObject({
      owner: 'tenant',
      isMetorialManaged: false,
      type: 'local'
    });

    let validation = await validate(fixture, imported.id);
    expect(validation.keyProviderId).toBe(imported.id);
    expect(validations).toEqual([{ keyProviderId: imported.id, validationFor: imported.id }]);

    expect(await listErrors(fixture, imported.id)).toEqual([]);
  });

  it('refuses to validate or list errors for Metorial-managed providers', async () => {
    let fixture = await load(org);
    let validated: string[] = [];

    onTestFinished(
      Fabric.listen('key_provider.validated:after', event => {
        validated.push(event.keyProvider.id);
      })
    );

    let managed = await createManaged(fixture);

    await expectServiceError(validate(fixture, managed.id), 'bad_request');
    await expectServiceError(listErrors(fixture, managed.id), 'bad_request');
    expect(validated).not.toContain(managed.id);
  });

  it('fires creation and default events with the acting organization actor', async () => {
    let fixture = await load(org);
    let events: { event: string; keyProviderId?: string; actorId: string }[] = [];

    for (let event of [
      'key_provider.managed.created:before',
      'key_provider.imported:before'
    ] as const) {
      onTestFinished(
        Fabric.listen(event, data => {
          if (data.organization.id === fixture.organization.id) {
            events.push({ event, actorId: data.performedBy.id });
          }
        })
      );
    }
    for (let event of [
      'key_provider.managed.created:after',
      'key_provider.imported:after',
      'key_provider.default.set:after'
    ] as const) {
      onTestFinished(
        Fabric.listen(event, data => {
          if (data.organization.id === fixture.organization.id) {
            events.push({
              event,
              keyProviderId: data.keyProvider.id,
              actorId: data.performedBy.id
            });
          }
        })
      );
    }

    let managed = await createManaged(fixture);
    let imported = await importKeyProvider(fixture);
    await setDefault(fixture, managed.id);

    let actorId = fixture.actor.id;
    expect(events).toEqual([
      { event: 'key_provider.managed.created:before', actorId },
      { event: 'key_provider.managed.created:after', keyProviderId: managed.id, actorId },
      { event: 'key_provider.imported:before', actorId },
      { event: 'key_provider.imported:after', keyProviderId: imported.id, actorId },
      { event: 'key_provider.default.set:after', keyProviderId: managed.id, actorId }
    ]);
  });

  it('counts only tenant-owned providers before an import', async () => {
    let fixture = await load(countingOrg);
    let counts: number[] = [];

    onTestFinished(
      Fabric.listen('key_provider.imported:before', event => {
        if (event.organization.id === fixture.organization.id) counts.push(event.currentCount);
      })
    );

    let initial = (await listKeyProviders(fixture)).filter(
      item => item.owner === 'tenant'
    ).length;

    await importKeyProvider(fixture);
    await importKeyProvider(fixture);
    await createManaged(fixture);
    await importKeyProvider(fixture);

    expect(counts).toEqual([initial, initial + 1, initial + 2]);
  });

  it.fails(
    "counts only the tenant's own managed providers before creating one (bug: the global system default provider is counted as a managed provider of every tenant)",
    async () => {
      let fixture = await load(countingOrg);
      let counts: number[] = [];

      onTestFinished(
        Fabric.listen('key_provider.managed.created:before', event => {
          if (event.organization.id === fixture.organization.id)
            counts.push(event.currentCount);
        })
      );

      let before = (await listKeyProviders(fixture)).filter(
        item => item.isMetorialManaged && item.owner === 'system'
      );
      let ownManaged = before.length - 1;

      await createManaged(fixture);

      expect(counts).toEqual([ownManaged]);
    }
  );

  it('does not create a provider when a :before listener vetoes it', async () => {
    let fixture = await load(org);
    let name = uniqueId('vetoed-kp');

    onTestFinished(
      Fabric.listen('key_provider.managed.created:before', event => {
        if (event.organization.id === fixture.organization.id)
          throw new Error('limit reached');
      })
    );
    onTestFinished(
      Fabric.listen('key_provider.imported:before', event => {
        if (event.organization.id === fixture.organization.id)
          throw new Error('limit reached');
      })
    );

    let tenantOwnedBefore = (await listKeyProviders(fixture)).filter(
      item => item.owner === 'tenant'
    ).length;

    await expect(createManaged(fixture, name)).rejects.toThrow('limit reached');
    await expect(importKeyProvider(fixture)).rejects.toThrow('limit reached');

    let after = await listKeyProviders(fixture);
    expect(after.map(item => item.name)).not.toContain(name);
    expect(after.filter(item => item.owner === 'tenant')).toHaveLength(tenantOwnedBefore);
  });

  it("does not resolve another tenant's key providers", async () => {
    let fixture = await load(org);
    let other = await load(otherOrg);

    let managed = await createManaged(fixture);
    let imported = await importKeyProvider(fixture);
    let otherDefaultsBefore = await defaultIds(other);

    for (let keyProviderId of [managed.id, imported.id]) {
      await expectServiceError(getKeyProvider(other, keyProviderId), 'not_found');
      await expectServiceError(setDefault(other, keyProviderId), 'not_found');
      await expectServiceError(validate(other, keyProviderId), 'not_found');
      await expectServiceError(listErrors(other, keyProviderId), 'not_found');
    }

    let otherListed = (await listKeyProviders(other)).map(item => item.id);
    expect(otherListed).not.toContain(managed.id);
    expect(otherListed).not.toContain(imported.id);
    expect(await defaultIds(other)).toEqual(otherDefaultsBefore);

    expect((await getKeyProvider(fixture, managed.id)).id).toBe(managed.id);
  });

  it('rejects unknown key provider ids', async () => {
    let fixture = await load(org);
    let unknownId = uniqueId('kprov');

    await expectServiceError(getKeyProvider(fixture, unknownId), 'not_found');
    await expectServiceError(setDefault(fixture, unknownId), 'not_found');
  });

  it("returns setup instructions bound to the project's tenant", async () => {
    let fixture = await load(org);

    let setup = await keyProviderService.getSetupInfo({
      organization: fixture.organization,
      project: fixture.project,
      input: {}
    });
    expect(setup.steps.length).toBeGreaterThan(0);

    let project = await db.project.findUniqueOrThrow({ where: { oid: fixture.project.oid } });
    expect(JSON.stringify(setup.steps)).toContain(project.nebulaTenantId!);
  });
});
