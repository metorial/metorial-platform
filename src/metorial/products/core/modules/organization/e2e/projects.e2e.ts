import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { projectService } from '../src';

describe('module-organization projects', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createProject = async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let project = await projectService.createProject({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Project') }
    });
    let lookup = (projectId: string, organization = fixture.organization) =>
      projectService.getProjectById({
        organization,
        projectId,
        actor: fixture.actor,
        member: fixture.member
      });
    return { fixture, project, lookup };
  };

  it('creates a project with a production instance', async () => {
    let { fixture, project } = await createProject();

    let instances = await db.instance.findMany({ where: { projectOid: project.oid } });
    expect(instances.map(instance => instance.type)).toEqual(['production']);

    let projects = await firstPage(
      await projectService.listProjects({
        organization: fixture.organization,
        actor: fixture.actor,
        member: fixture.member
      })
    );
    expect(projects.map(item => item.id)).toContain(project.id);
  });

  it('keeps resolving a renamed project by its previous slug', async () => {
    let { fixture, project, lookup } = await createProject();
    let slug = uniqueId('renamed').toLowerCase();

    let renamed = await projectService.updateProject({
      project,
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { slug }
    });
    expect(renamed.slug).toBe(slug);
    expect(renamed.previousSlugs).toEqual([project.slug]);

    expect((await lookup(slug)).id).toBe(project.id);
    expect((await lookup(project.slug)).id).toBe(project.id);

    let filtered = await firstPage(
      await projectService.listProjects({
        organization: fixture.organization,
        actor: fixture.actor,
        member: fixture.member,
        projectIds: [project.slug]
      })
    );
    expect(filtered.map(item => item.id)).toEqual([project.id]);
  });

  it('refuses a slug in use and lets another project reclaim a previous slug', async () => {
    let first = await createProject();
    let second = await createProject();

    await expectServiceError(
      projectService.updateProject({
        project: second.project,
        organization: second.fixture.organization,
        auditScope: second.fixture.auditScope,
        input: { slug: first.project.slug }
      }),
      'conflict'
    );

    let freedSlug = first.project.slug;
    await projectService.updateProject({
      project: first.project,
      organization: first.fixture.organization,
      auditScope: first.fixture.auditScope,
      input: { slug: uniqueId('moved').toLowerCase() }
    });
    let reclaimed = await projectService.updateProject({
      project: second.project,
      organization: second.fixture.organization,
      auditScope: second.fixture.auditScope,
      input: { slug: freedSlug }
    });
    expect(reclaimed.slug).toBe(freedSlug);

    let previous = await db.project.findUniqueOrThrow({ where: { id: first.project.id } });
    expect(previous.previousSlugs).not.toContain(freedSlug);
    expect((await second.lookup(freedSlug)).id).toBe(second.project.id);
  });

  it('does not delete projects or resolve them from another organization', async () => {
    let { fixture, project, lookup } = await createProject();
    let other = await loadOrganizationFixture(otherOrg.ids);

    await expectServiceError(
      projectService.deleteProject({
        project,
        organization: fixture.organization,
        auditScope: fixture.auditScope
      }),
      'not_implemented'
    );
    await expectServiceError(lookup(project.id, other.organization), 'not_found');
    await expectServiceError(lookup(project.slug, other.organization), 'not_found');
  });
});
