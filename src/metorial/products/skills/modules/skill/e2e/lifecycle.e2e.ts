import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { skillService } from '../src';
import {
  captureFabric,
  createSkill,
  getSkill,
  memberAuthorization,
  privileged,
  searchToken
} from './_fixtures';

describe('module-skill lifecycle', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a skill with its own private store, a name-based slug and a creator participant', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let authorization = await memberAuthorization(fixture);
    let name = uniqueId('skill');
    let created = captureFabric('skill.audit.created:after');

    let skill = await skillService
      .createSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: {
          id: await ID.generateId('skill'),
          authorization,
          name,
          description: 'Described',
          metadata: { team: 'e2e' },
          clientName: 'Client name',
          clientDescription: 'Client description',
          license: 'MIT',
          compatibility: 'any agent'
        }
      })
      .finally(created.stop);

    let row = await db.skill.findUniqueOrThrow({
      where: { id: skill.id },
      include: { store: true, skillParticipants: true }
    });
    expect(row).toMatchObject({
      status: 'active',
      ownerType: 'instance',
      name,
      description: 'Described',
      metadata: { team: 'e2e' },
      clientName: 'Client name',
      clientDescription: 'Client description',
      license: 'MIT',
      compatibility: 'any agent',
      skillEntityId: skill.id,
      parentSkillOid: null,
      forkedFromSkillVersionOid: null,
      organizationOid: fixture.organization.oid,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      createdByResourceActorOid: authorization.resourceActor!.oid
    });
    expect(row.slug).toMatch(new RegExp(`^${name}-[a-z0-9]{5}$`));
    expect(row.store).toMatchObject({
      id: row.storeId,
      name,
      access: 'private',
      instanceOid: fixture.instance.oid
    });
    expect(row.skillParticipants.map(participant => participant.roles)).toEqual([['creator']]);

    let events = created.events.filter(event => event.skill.id === skill.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      parentSkillId: null,
      parentSkillTemplateId: null,
      cloneType: null
    });
  });

  it('defaults the client name to the name and keeps slug and client name on rename', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    expect(skill.clientName).toBe(skill.name);

    let renamed = uniqueId('renamed-skill');
    let updatedEvents = captureFabric('skill.audit.updated:after');
    let updated = await skillService
      .updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill,
        authorization: privileged,
        input: { name: renamed }
      })
      .finally(updatedEvents.stop);
    expect(updated.name).toBe(renamed);
    expect(updated.store?.name).toBe(renamed);

    let row = await db.skill.findUniqueOrThrow({
      where: { id: skill.id },
      include: { store: true }
    });
    expect(row.name).toBe(renamed);
    expect(row.slug).toBe(skill.slug);
    expect(row.clientName).toBe(skill.name);
    expect(row.store?.name).toBe(renamed);
    expect(row.updatedAt.getTime()).toBeGreaterThan(skill.updatedAt.getTime());

    let event = updatedEvents.events.find(item => item.skill.id === skill.id);
    expect(event?.previousSkill.name).toBe(skill.name);
    expect(event?.skill.name).toBe(renamed);
  });

  it('clears nullable fields and replaces metadata', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await skillService.createSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: {
        id: await ID.generateId('skill'),
        authorization: privileged,
        name: uniqueId('skill'),
        description: 'Described',
        metadata: { first: true },
        license: 'MIT'
      }
    });

    let updated = await skillService.updateSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill,
      authorization: privileged,
      input: { description: null, license: null, metadata: { second: true } }
    });
    expect(updated).toMatchObject({
      name: skill.name,
      description: null,
      license: null,
      metadata: { second: true }
    });

    let row = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(row).toMatchObject({
      description: null,
      license: null,
      metadata: { second: true }
    });
  });

  it('rejects blank names and empty updates without writing', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skillId = await ID.generateId('skill');

    let blank = await expectServiceError(
      skillService.createSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: { id: skillId, authorization: privileged, name: '   ' }
      }),
      'bad_request'
    );
    expect(blank.message).toMatch(/name cannot be empty/);
    expect(await db.skill.findUnique({ where: { id: skillId } })).toBeNull();

    let skill = await createSkill(fixture);

    let empty = await expectServiceError(
      skillService.updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill,
        authorization: privileged,
        input: {}
      }),
      'bad_request'
    );
    expect(empty.message).toMatch(/At least one skill field/);

    await expectServiceError(
      skillService.updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill,
        authorization: privileged,
        input: { name: '  ', description: 'Changed' }
      }),
      'bad_request'
    );

    let row = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(row.name).toBe(skill.name);
    expect(row.description).toBe(skill.description);
  });

  it('archives a skill, hides it from default reads and keeps archiving idempotent', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let archivedEvents = captureFabric('skill.audit.archived:after');

    let archived = await skillService
      .archiveSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill,
        authorization: privileged
      })
      .finally(archivedEvents.stop);
    expect(archived.id).toBe(skill.id);
    expect(archived.status).toBe('archived');
    expect(archivedEvents.events.map(event => event.skill.id)).toContain(skill.id);

    let row = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(row.status).toBe('archived');

    await expectServiceError(getSkill(fixture, skill.id), 'not_found');
    let withDeleted = await getSkill(fixture, skill.id, { allowDeleted: true });
    expect(withDeleted.status).toBe('archived');

    let listSkillIds = async (filters: { statuses?: ['archived']; allowDeleted?: boolean }) =>
      (
        await firstPage(
          await skillService.listSkills({
            project: fixture.project,
            instance: fixture.instance,
            ids: [skill.id],
            ...filters
          })
        )
      ).map(item => item.id);

    expect(await listSkillIds({})).toEqual([]);
    expect(await listSkillIds({ statuses: ['archived'] })).toEqual([skill.id]);
    expect(await listSkillIds({ allowDeleted: true })).toEqual([skill.id]);

    let again = await skillService.archiveSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: withDeleted,
      authorization: privileged
    });
    expect(again.status).toBe('archived');
  });

  it('updates an archived skill loaded with allowDeleted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);

    await skillService.archiveSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill,
      authorization: privileged
    });
    let archived = await getSkill(fixture, skill.id, { allowDeleted: true });

    let updated = await skillService.updateSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: archived,
      authorization: privileged,
      input: { description: 'Edited after archiving' }
    });
    expect(updated).toMatchObject({
      status: 'archived',
      description: 'Edited after archiving'
    });
  });

  it('lists skills by parent, creator and creation time', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let authorization = await memberAuthorization(fixture);
    let before = new Date(Date.now() - 1000);

    let parent = await createSkill(fixture, { authorization });
    let duplicate = await createSkill(fixture, {
      parentSkill: parent,
      parentSkillCloneType: 'duplicate'
    });

    let list = async (filters: Parameters<typeof skillService.listSkills>[0]) =>
      (await firstPage(await skillService.listSkills(filters))).map(item => item.id);

    let scope = { project: fixture.project, instance: fixture.instance };

    expect(await list({ ...scope, parentSkillIds: [parent.id] })).toEqual([duplicate.id]);
    expect(
      await list({
        ...scope,
        ids: [parent.id, duplicate.id],
        createdByActorIds: [authorization.resourceActor!.id]
      })
    ).toEqual([parent.id]);
    expect(
      (
        await list({
          ...scope,
          ids: [parent.id, duplicate.id],
          createdAt: { gt: before }
        })
      ).sort()
    ).toEqual([parent.id, duplicate.id].sort());
    expect(
      await list({
        ...scope,
        ids: [parent.id, duplicate.id],
        createdAt: { lt: before }
      })
    ).toEqual([]);
  });

  it('does not resolve, list, update or archive a skill from another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);

    await expectServiceError(getSkill(other, skill.id), 'not_found');
    await expectServiceError(getSkill(other, skill.id, { allowDeleted: true }), 'not_found');

    let listed = await firstPage(
      await skillService.listSkills({
        project: other.project,
        instance: other.instance,
        ids: [skill.id],
        allowDeleted: true
      })
    );
    expect(listed).toEqual([]);

    let foreignUpdate = await expectServiceError(
      skillService.updateSkill({
        project: other.project,
        instance: other.instance,
        auditScope: other.auditScope,
        skill,
        authorization: privileged,
        input: { name: uniqueId('hijacked') }
      }),
      'bad_request'
    );
    expect(foreignUpdate.message).toMatch(/does not belong/);

    await expectServiceError(
      skillService.archiveSkill({
        project: other.project,
        instance: other.instance,
        auditScope: other.auditScope,
        skill,
        authorization: privileged
      }),
      'bad_request'
    );

    let row = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(row).toMatchObject({ name: skill.name, status: 'active' });
  });

  it('indexes skills for search within their project and drops them on archive', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let token = searchToken();
    let skill = await createSkill(fixture, {
      name: `Searchable ${token}`,
      description: 'Indexed by the skill lifecycle worker'
    });

    let search = async (target: typeof fixture, statuses?: Array<'active' | 'archived'>) =>
      (
        await firstPage(
          await skillService.listSkills({
            project: target.project,
            instance: target.instance,
            search: token,
            statuses
          })
        )
      ).map(item => item.id);

    await eventually(async () => expect(await search(fixture)).toEqual([skill.id]), {
      timeoutMs: 20_000,
      intervalMs: 500
    });
    expect(await search(other)).toEqual([]);

    await skillService.archiveSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill,
      authorization: privileged
    });

    await eventually(
      async () => expect(await search(fixture, ['active', 'archived'])).toEqual([]),
      { timeoutMs: 20_000, intervalMs: 500 }
    );
  });
});
