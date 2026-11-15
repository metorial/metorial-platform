import { uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { resourceActorService } from '../src';

describe('module-resource-actor', () => {
  let org = useOrganization();

  it('upserts external actors by identifier and resolves them by id or identifier', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let identifier = uniqueId('actor');

    let created = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier, name: 'First Name' }
    });
    expect(created.type).toBe('external');
    expect(created.projectOid).toBe(fixture.project.oid);

    let updated = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier, name: 'Second Name' }
    });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Second Name');

    let byId = await resourceActorService.getActorById({
      project: fixture.project,
      actorId: created.id
    });
    expect(byId.identifier).toBe(identifier);

    let byIdentifier = await resourceActorService.getActorById({
      project: fixture.project,
      actorId: identifier
    });
    expect(byIdentifier.id).toBe(created.id);

    await expect(
      resourceActorService.getActorById({
        project: fixture.project,
        actorId: uniqueId('nope')
      })
    ).rejects.toThrow();
  });

  it('ensures a single resource actor per organization actor and project', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let ensured = await resourceActorService.getOrEnsureOrganizationActor({
      project: fixture.project,
      organizationActor: fixture.actor
    });
    expect(ensured.identifier).toBe(`mte-oac-${fixture.actor.id}`);
    expect(ensured.organizationActorOid).toBe(fixture.actor.oid);

    let again = await resourceActorService.ensureOrganizationActor({
      project: fixture.project,
      organizationActorOid: fixture.actor.oid
    });
    expect(again.id).toBe(ensured.id);
  });
});
