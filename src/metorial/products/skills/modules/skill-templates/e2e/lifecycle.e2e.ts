import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { storeService } from '@metorial/module-store';
import { describe, expect, it } from 'vitest';
import { skillTemplateService } from '../src';
import {
  addDocument,
  captureFabric,
  createTemplate,
  readStoreDocument,
  scopeOf,
  storeDirectoryPaths,
  storeFilePaths,
  syncTimeout,
  templateItems,
  type TemplateItems
} from './_fixtures';

let listIds = async (
  fixture: OrganizationFixture,
  filters: Omit<
    Parameters<typeof skillTemplateService.listSkillTemplates>[0],
    'project' | 'instance'
  >
) =>
  (
    await firstPage(
      await skillTemplateService.listSkillTemplates({ ...scopeOf(fixture), ...filters })
    )
  ).map(template => template.id);

let byPath = <T extends { path: string }>(items: T[]) =>
  [...items].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

describe('module-skill-templates lifecycle', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a standalone template from items and persists both records', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('template');
    let created = captureFabric('skill.template.audit.created:after');

    let template = await createTemplate(fixture, {
      name,
      metadata: { team: 'e2e' },
      items: templateItems()
    }).finally(created.stop);

    let row = await db.skillTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: { storeTemplate: { include: { items: { orderBy: { path: 'asc' } } } } }
    });
    expect(row).toMatchObject({
      status: 'active',
      owner: 'tenant',
      name,
      description: 'Created by the e2e suite',
      metadata: { team: 'e2e' },
      storeId: null,
      systemIdentifier: null,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      organizationOid: fixture.organization.oid
    });
    expect(row.slug).toMatch(new RegExp(`^${name}-[a-z0-9]{5}$`));
    expect(row.storeTemplate).toMatchObject({
      type: 'standalone',
      name,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      sourceStoreOid: null
    });
    expect(
      byPath(row.storeTemplate!.items).map(item => ({
        path: item.path,
        kind: item.kind,
        content: item.content,
        encoding: item.encoding
      }))
    ).toEqual([
      {
        path: '/SKILL.md',
        kind: 'document',
        content: '# Template\n\nTemplate body\n',
        encoding: 'utf_8'
      },
      { path: '/assets/', kind: 'directory', content: null, encoding: null },
      {
        path: '/references/guide.md',
        kind: 'document',
        content: '# Guide\n\nRead me\n',
        encoding: 'utf_8'
      }
    ]);

    expect(created.events.find(event => event.skillTemplate.id === template.id)).toMatchObject(
      {
        skillTemplate: { name, slug: row.slug, status: 'active' },
        auditScope: { organizationOid: fixture.organization.oid }
      }
    );

    let fetched = await skillTemplateService.getSkillTemplateById({
      ...scopeOf(fixture),
      skillTemplateId: template.id
    });
    expect(byPath(fetched.storeTemplate.items).map(item => item.path)).toEqual([
      '/SKILL.md',
      '/assets/',
      '/references/guide.md'
    ]);
    expect(await listIds(fixture, { ids: [template.id], owners: ['tenant'] })).toEqual([
      template.id
    ]);
  });

  it('copies the plain template into a backing store when no source is given', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('template');

    let template = await createTemplate(fixture, { name });

    expect(template.storeTemplate?.type).toBe('linked_store');
    expect(template.storeTemplate?.items).toEqual([]);
    expect(template.storeId).toBeTruthy();

    let store = await db.store.findUniqueOrThrow({ where: { id: template.storeId! } });
    expect(store).toMatchObject({
      name: `Skill Template Store - ${name}`,
      access: 'public_read',
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid
    });
    expect(template.storeTemplate?.sourceStore?.id).toBe(store.id);

    expect(await storeFilePaths(store.id)).toEqual(['/SKILL.md']);
    expect(await storeDirectoryPaths(store.id)).toEqual(
      expect.arrayContaining(['/assets/', '/references/'])
    );
    expect(await readStoreDocument(fixture, store.id, '/SKILL.md')).toContain(
      'Set the scene, define the problem and task.'
    );
  });

  it('links an existing store and makes it publicly readable', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await storeService.createStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      input: { name: uniqueId('store'), access: 'private' }
    });
    await addDocument(fixture, store.id, '/SKILL.md', '# Linked\n\nFrom a store\n');

    let template = await createTemplate(fixture, { storeId: store.id });

    expect(template.storeId).toBe(store.id);
    expect(template.storeTemplate).toMatchObject({
      type: 'linked_store',
      sourceStore: { id: store.id }
    });
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).access).toBe(
      'public_read'
    );
  });

  it('normalizes item paths so they cannot leave the template root', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let template = await createTemplate(fixture, {
      items: [
        { path: '/SKILL.md', type: 'document', content: '# Root\n', encoding: 'utf-8' },
        {
          path: '/../../etc/passwd.md',
          type: 'document',
          content: '# Escaped\n',
          encoding: 'utf-8'
        },
        {
          path: '..\\..\\docs\\<script>notes.md',
          type: 'file',
          content: Buffer.from('binary').toString('base64'),
          encoding: 'base64',
          mimeType: 'text/markdown'
        }
      ]
    });

    expect(template.storeTemplate?.items.map(item => item.path).sort()).toEqual([
      '/SKILL.md',
      '/docs/scriptnotes.md',
      '/etc/passwd.md'
    ]);
  });

  it('rejects invalid items, sources and names without creating anything', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let countRows = async () => ({
      templates: await db.skillTemplate.count({
        where: { instanceOid: fixture.instance.oid }
      }),
      stores: await db.store.count({ where: { instanceOid: fixture.instance.oid } })
    });
    let before = await countRows();
    let document = (path: string): TemplateItems[number] => ({
      path,
      type: 'document',
      content: '# Doc\n',
      encoding: 'utf-8'
    });

    let cases: Array<[Parameters<typeof createTemplate>[1], RegExp]> = [
      [
        { items: [{ path: '/assets/', type: 'directory', content: 'x', encoding: 'utf-8' }] },
        /Directory template items cannot include content/
      ],
      [
        { items: [{ path: '/SKILL.md', type: 'document', content: '# Doc' }] },
        /require content and encoding/
      ],
      [
        { items: [{ ...document('/SKILL.md'), mimeType: 'text/markdown' }] },
        /Only file template items can include mimeType/
      ],
      [
        {
          items: [
            {
              path: '/logo.png',
              type: 'file',
              content: 'AA==',
              encoding: 'base64',
              title: 'Logo'
            }
          ]
        },
        /Only document template items can include title/
      ],
      [
        { items: [{ ...document('/SKILL.md'), title: '   ' }] },
        /Document template item title cannot be empty/
      ],
      [
        { items: [document('/notes.md'), document('/../notes.md')] },
        /Store template item path already exists: \/notes\.md/
      ],
      [{ items: [document('/..')] }, /Store file paths must include a file name/],
      [
        { items: templateItems(), storeId: 'str_does_not_exist' },
        /Provide exactly one of skillId, storeId, or items/
      ],
      [{ name: '   ' }, /Skill template name cannot be empty/],
      [{ name: '   ', items: templateItems() }, /Skill template name cannot be empty/]
    ];

    for (let [input, message] of cases) {
      let error = await expectServiceError(createTemplate(fixture, input), 'bad_request');
      expect(error.message).toMatch(message);
    }

    await expectServiceError(
      createTemplate(fixture, { skillId: 'skl_does_not_exist' }),
      'not_found'
    );
    await expectServiceError(
      createTemplate(fixture, { storeId: 'str_does_not_exist' }),
      'not_found'
    );

    expect(await countRows()).toEqual(before);
  });

  it('updates fields and items, and reports the previous state', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture);
    let storeTemplateItemIds = new Map(
      template.storeTemplate!.items.map(item => [item.path, item.id])
    );

    let metadataOnly = await skillTemplateService.updateSkillTemplate({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skillTemplateId: template.id,
      input: { description: 'Only the description', metadata: { version: 2 } }
    });
    expect(metadataOnly).toMatchObject({
      name: template.name,
      description: 'Only the description',
      metadata: { version: 2 }
    });
    expect(metadataOnly.storeTemplate?.items).toHaveLength(3);

    let renamed = uniqueId('renamed');
    let updated = captureFabric('skill.template.audit.updated:after');
    let result = await skillTemplateService
      .updateSkillTemplate({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        skillTemplateId: template.id,
        input: {
          name: renamed,
          description: null,
          metadata: null,
          items: [
            {
              path: '/SKILL.md',
              type: 'document',
              content: '# Template\n\nChanged body\n',
              encoding: 'utf-8'
            },
            { path: '/assets/', type: 'directory' },
            { path: '/scripts/run.sh', type: 'file', content: 'echo hi', encoding: 'utf-8' }
          ]
        }
      })
      .finally(updated.stop);

    expect(result).toMatchObject({ name: renamed, description: null, metadata: null });
    expect(result.slug).toBe(template.slug);

    let row = await db.storeTemplate.findUniqueOrThrow({
      where: { id: template.storeTemplate!.id },
      include: { items: { orderBy: { path: 'asc' } } }
    });
    expect(row.name).toBe(renamed);
    expect(byPath(row.items).map(item => [item.path, item.content])).toEqual([
      ['/SKILL.md', '# Template\n\nChanged body\n'],
      ['/assets/', null],
      ['/scripts/run.sh', 'echo hi']
    ]);
    expect(row.items.find(item => item.path === '/SKILL.md')?.id).toBe(
      storeTemplateItemIds.get('/SKILL.md')
    );
    expect(row.items.find(item => item.path === '/assets/')?.id).toBe(
      storeTemplateItemIds.get('/assets/')
    );

    expect(updated.events.find(event => event.skillTemplate.id === template.id)).toMatchObject(
      {
        skillTemplate: { name: renamed, description: null },
        previousSkillTemplate: { name: template.name, description: 'Only the description' }
      }
    );

    await expectServiceError(
      skillTemplateService.updateSkillTemplate({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        skillTemplateId: template.id,
        input: { name: '  ' }
      }),
      'bad_request'
    );
    expect(
      (await db.skillTemplate.findUniqueOrThrow({ where: { id: template.id } })).name
    ).toBe(renamed);
  });

  it('only allows item updates on standalone templates', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture, { name: uniqueId('linked') });

    let error = await expectServiceError(
      skillTemplateService.updateSkillTemplate({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        skillTemplateId: template.id,
        input: { items: templateItems() }
      }),
      'bad_request'
    );
    expect(error.message).toMatch(/does not support standalone item updates/);
  });

  it('archives a template once and keeps it readable but frozen', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture);
    let archivedEvents = captureFabric('skill.template.audit.archived:after');

    let archived = await skillTemplateService
      .deleteSkillTemplate({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        skillTemplateId: template.id
      })
      .finally(archivedEvents.stop);

    expect(archived.status).toBe('archived');
    expect(archivedEvents.events.map(event => event.skillTemplate.id)).toEqual([template.id]);
    expect(
      await db.storeTemplate.findUnique({ where: { id: template.storeTemplate!.id } })
    ).not.toBeNull();

    let fetched = await skillTemplateService.getSkillTemplateById({
      ...scopeOf(fixture),
      skillTemplateId: template.id
    });
    expect(fetched.status).toBe('archived');
    expect(await listIds(fixture, { ids: [template.id] })).toEqual([template.id]);
    expect(await listIds(fixture, { ids: [template.id], statuses: ['archived'] })).toEqual([
      template.id
    ]);
    expect(await listIds(fixture, { ids: [template.id], statuses: ['active'] })).toEqual([]);

    await expectServiceError(
      skillTemplateService.updateSkillTemplate({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        skillTemplateId: template.id,
        input: { name: uniqueId('revived') }
      }),
      'gone'
    );
    await expectServiceError(
      skillTemplateService.deleteSkillTemplate({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        skillTemplateId: template.id
      }),
      'gone'
    );

    let row = await db.skillTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(row).toMatchObject({ status: 'archived', name: template.name });
  });

  it('reads the default plain template without rewriting it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let plain = await skillTemplateService.getDefaultSkillTemplate(scopeOf(fixture));
    let before = await db.skillTemplate.findUniqueOrThrow({
      where: { id: plain.id },
      include: { storeTemplate: true }
    });

    await skillTemplateService.getDefaultSkillTemplate(scopeOf(fixture));
    await listIds(fixture, { ids: [plain.id] });

    let after = await db.skillTemplate.findUniqueOrThrow({
      where: { id: plain.id },
      include: { storeTemplate: true }
    });
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.storeTemplate?.updatedAt).toEqual(before.storeTemplate?.updatedAt);
  });

  it('indexes templates for search within their project and drops them on archive', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let token = uniqueId('tplsrch').replace(/-/g, '');
    let template = await createTemplate(fixture, {
      name: `Searchable ${token}`,
      items: templateItems()
    });

    await eventually(
      async () => expect(await listIds(fixture, { search: token })).toContain(template.id),
      syncTimeout
    );
    expect(await listIds(other, { search: token })).toEqual([]);

    await skillTemplateService.deleteSkillTemplate({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skillTemplateId: template.id
    });

    await eventually(
      async () => expect(await listIds(fixture, { search: token })).not.toContain(template.id),
      syncTimeout
    );
  });
});
