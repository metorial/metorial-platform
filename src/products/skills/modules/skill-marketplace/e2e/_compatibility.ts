import { hashBytes } from '@lowerdeck/hash/content';
import { eventually, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import {
  filePurposeService,
  fileService,
  getCargoFilesBucketName,
  getStorage
} from '@metorial/module-file';
import { skillAgentService } from '@metorial/module-skill';
import { storeService } from '@metorial/module-store';
import { getOriginTenant, origin as originClient } from '@metorial/skills-scm-utils';
import { expect } from 'vitest';
import {
  managedSkillPluginService,
  skillMarketplaceRepositoryService,
  skillPluginRepositoryService,
  skillPluginService,
  skillPluginSkillService
} from '../src';
import { forceSkillDestinationSync } from '../src/lib/destinationSync';
import { readStoredManifestFile } from '../src/lib/manifestFile/storage';
import type { SerializerContext, StorageBackedFile } from '../src/serializers/_lib/types';
import { applyMarketplace } from '../src/serializers/marketplace';
import { applyPlugin } from '../src/serializers/plugin';
import { applySkill } from '../src/serializers/skill';
import {
  addDocument,
  addSkillToPlugin,
  createMarketplace,
  createPlugin,
  createSkill,
  getSkill,
  loadMarketplaceSerializerInput,
  loadStandalonePluginSerializerInput,
  privileged,
  type FakeOrigin
} from './_fixtures';

export let syncTimeout = { timeoutMs: 240_000, intervalMs: 1000 };

let activeSyncStatuses = ['pending', 'processing', 'waiting_for_review'] as const;

export type DestinationKind = 'marketplace' | 'plugin' | 'managed';

let toBuffer = (content: string | Buffer | ArrayBuffer | Uint8Array) =>
  typeof content === 'string'
    ? Buffer.from(content, 'utf-8')
    : Buffer.from(content as Uint8Array);

let joinPath = (base: string, path: string) =>
  [base, path.replace(/^\/+/, '')].filter(Boolean).join('/');

export let readStoredFileBytes = async (file: StorageBackedFile) => {
  let source = await fileService.resolveFileContentSource({ file });
  if (source.type === 'inline') return source.content;

  return toBuffer((await getStorage().getObject(source.bucket, source.key)).data);
};

export let readObjectBytes = async (key: string) =>
  toBuffer((await getStorage().getObject(getCargoFilesBucketName(), key)).data);

// Byte-exact stand-in for the sync process stage: what the serializers write for a destination.
let renderInto = async <Input, InitResult>(
  files: Map<string, Buffer>,
  serializer: {
    init: (input: Input) => Promise<InitResult>;
    apply: (input: Input, context: SerializerContext, initResult: InitResult) => Promise<void>;
  },
  input: Input
) => {
  let basePath = '';
  let pending: Promise<void>[] = [];
  let context: SerializerContext = {
    setBasePath: path => {
      basePath = (path ?? '').replace(/^\/+|\/+$/g, '');
    },
    setFile: async (path, content) => {
      files.set(joinPath(basePath, path), toBuffer(content));
    },
    setFileFromStorage: async (path, file) => {
      let resolved = joinPath(basePath, path);
      pending.push(
        readStoredFileBytes(file).then(bytes => {
          files.set(resolved, bytes);
        })
      );
    },
    deletePath: async path => {
      let prefix = joinPath(basePath, path);
      for (let key of [...files.keys()]) {
        if (key === prefix || key.startsWith(`${prefix}/`)) files.delete(key);
      }
    }
  };

  await serializer.apply(input, context, await serializer.init(input));
  await Promise.all(pending);
};

export let renderDestination = async (target: CompatTarget) => {
  let files = new Map<string, Buffer>();

  if (target.kind === 'marketplace') {
    let input = await loadMarketplaceSerializerInput(target.marketplaceId!);
    await renderInto(files, applyMarketplace, { skillMarketplace: input.skillMarketplace });
    for (let plugin of input.plugins) {
      await renderInto(files, applyPlugin, {
        skillPlugin: plugin.skillPlugin,
        skillMarketplace: input.skillMarketplace,
        skillMarketplacePlugin: plugin.skillMarketplacePlugin
      });
      for (let skill of plugin.skills) await renderInto(files, applySkill, skill);
    }
    return files;
  }

  let input = await loadStandalonePluginSerializerInput(target.pluginId);
  await renderInto(files, applyPlugin, { skillPlugin: input.skillPlugin });
  for (let skill of input.skills) await renderInto(files, applySkill, skill);
  return files;
};

export let rowPath = (row: { path: string }) => row.path.replace(/^\/+/, '');

export let sortedPaths = (files: Map<string, unknown> | Iterable<string>) =>
  [...(files instanceof Map ? files.keys() : files)].sort();

export let expectSameFiles = (actual: Map<string, Buffer>, expected: Map<string, Buffer>) => {
  expect(sortedPaths(actual)).toEqual(sortedPaths(expected));
  expect(
    sortedPaths(expected).filter(path => !actual.get(path)?.equals(expected.get(path)!))
  ).toEqual([]);
};

export let readManifestOf = async (manifest: {
  objectKey: string;
  sha256: string;
  entryCount: number;
}) =>
  await readStoredManifestFile({
    key: manifest.objectKey,
    sha256: manifest.sha256,
    entryCount: manifest.entryCount
  });

export let readManifestFiles = async (manifest: {
  objectKey: string;
  sha256: string;
  entryCount: number;
}) => {
  let parsed = await readManifestOf(manifest);
  let files = new Map<string, Buffer>();

  for (let entry of parsed.entries) {
    let bytes = await readObjectBytes(entry.key);
    expect(hashBytes(bytes), entry.path).toEqual({
      sha256: entry.sha256,
      gitBlobSha: entry.gitBlobSha,
      crc32: entry.crc32,
      size: entry.size
    });
    files.set(entry.path, bytes);
  }

  return { ...parsed, files };
};

let clearFlushSchedule = async (destinationOid: bigint) =>
  await db.skillDestination.update({
    where: { oid: destinationOid },
    data: {
      isDirty: false,
      shouldFlushAt: null,
      mustFlushAt: null,
      firstTransientChangeAt: null,
      lastTransientChangeAt: null
    }
  });

// Waits until the destination has no running sync and its newest sync (from `fromOid` on)
// completed. A sync the dirty flush starts meanwhile supersedes ours, so the newest one wins.
export let settleDestination = async (destinationOid: bigint, fromOid?: bigint) => {
  let settled = await eventually(async () => {
    let syncs = await db.skillDestinationSync.findMany({
      where: { destinationOid, ...(fromOid ? { oid: { gte: fromOid } } : {}) },
      orderBy: { oid: 'desc' },
      include: { manifest: true }
    });
    expect(syncs.length).toBeGreaterThan(0);
    expect(
      syncs
        .filter(sync => (activeSyncStatuses as readonly string[]).includes(sync.status))
        .map(sync => sync.id)
    ).toEqual([]);
    expect(syncs[0]!.status).toBe('completed');
    return syncs[0]!;
  }, syncTimeout);

  await clearFlushSchedule(destinationOid);
  return settled;
};

export let syncDestination = async (destinationOid: bigint) => {
  let sync = await forceSkillDestinationSync({ destination: { oid: destinationOid } });
  return await settleDestination(destinationOid, sync.oid);
};

let binaryBytes = (seed: string) => {
  let bytes = Buffer.alloc(768);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = (i * 31 + seed.charCodeAt(i % seed.length)) % 256;
  bytes.write('\x89PNG\r\n\x1a\n\0\0', 0, 'binary');
  return bytes;
};

let addStoreFile = async (
  fixture: OrganizationFixture,
  skill: { storeId: string },
  d: { path: string; name: string; mimeType: string; bytes: Buffer }
) => {
  let purpose = await filePurposeService.ensureGenericFilePurpose();
  let file = await fileService.createUploadedFile({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    purpose: purpose.id,
    file: new Blob([new Uint8Array(d.bytes)], { type: d.mimeType }),
    input: { name: d.name, title: d.path, mimeType: d.mimeType, authorization: privileged }
  });

  await storeService.modifyStoreItems({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    authorization: privileged,
    store: await db.store.findUniqueOrThrow({ where: { id: skill.storeId } }),
    operations: [{ type: 'add', path: d.path, fileId: file.id }]
  });

  return file;
};

export let removeStorePath = async (
  fixture: OrganizationFixture,
  skill: { storeId: string },
  path: string
) => {
  let store = await db.store.findUniqueOrThrow({ where: { id: skill.storeId } });
  let item = await db.storeItem.findFirstOrThrow({
    where: { storeOid: store.oid, path: { in: [path, path.replace(/^\/+/, '')] } }
  });

  await storeService.modifyStoreItems({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    authorization: privileged,
    store,
    operations: [{ type: 'remove', itemId: item.id }]
  });
};

export type SkillContent = Awaited<ReturnType<typeof fillSkill>>;

// Gives a skill every legacy content shape: rendered SKILL.md, nested documents, a pending
// (database-buffered) text file, a content-addressed binary, a binary whose File predates
// content hashes (random storeId, no hash columns), and an agent its plugin publishes.
let fillSkill = async (
  fixture: OrganizationFixture,
  skill: Awaited<ReturnType<typeof createSkill>>,
  label: string
) => {
  await addDocument(fixture, skill, '/SKILL.md', `# ${label}\n\n${skill.id}`);
  let guide = await addDocument(
    fixture,
    skill,
    '/references/guide.md',
    `guide v1 ${skill.id}`
  );
  await addDocument(fixture, skill, '/references/deep/nested/notes.md', `notes ${skill.id}`);

  let pendingBytes = Buffer.from(`pending ${uniqueId('text')}\n`);
  let pendingFile = await addStoreFile(fixture, skill, {
    path: '/references/data.txt',
    name: 'data.txt',
    mimeType: 'text/plain',
    bytes: pendingBytes
  });

  let iconBytes = binaryBytes(uniqueId('icon'));
  let iconFile = await addStoreFile(fixture, skill, {
    path: '/assets/icon.png',
    name: 'icon.png',
    mimeType: 'image/png',
    bytes: iconBytes
  });

  let legacyBytes = binaryBytes(uniqueId('legacy'));
  let legacyFile = await addStoreFile(fixture, skill, {
    path: '/assets/legacy.png',
    name: 'legacy.png',
    mimeType: 'image/png',
    bytes: legacyBytes
  });
  let legacyStoreId = `e2e-legacy-${uniqueId('upload')}`;
  await getStorage().putObject(getCargoFilesBucketName(), legacyStoreId, legacyBytes);
  await db.file.update({
    where: { oid: legacyFile.oid },
    data: {
      storeId: legacyStoreId,
      contentSha256: null,
      contentSha256StoreId: null,
      contentGitBlobSha: null,
      contentCrc32: null
    }
  });

  let agent = await skillAgentService.createSkillAgent({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skill: await getSkill(fixture, skill.id),
    input: {
      name: uniqueId('Triage Bot'),
      content: `# Triage ${skill.id}`,
      authorization: privileged
    }
  });

  return {
    skill,
    guideDocumentId: guide.id,
    agent,
    pending: { file: pendingFile, bytes: pendingBytes },
    icon: { file: iconFile, bytes: iconBytes },
    legacy: { file: legacyFile, bytes: legacyBytes, storeId: legacyStoreId }
  };
};

export let createSkillContent = async (fixture: OrganizationFixture, label: string) =>
  await fillSkill(fixture, await createSkill(fixture, { name: uniqueId(label) }), label);

export let skillFilePaths = [
  'SKILL.md',
  'assets/icon.png',
  'assets/legacy.png',
  'references/data.txt',
  'references/deep/nested/notes.md',
  'references/guide.md'
];

export let pluginFilePaths = (agentSlug: string) => [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
  '.mcp.json',
  `agents/${agentSlug}.md`,
  'assets/logo.svg',
  'mcp.json',
  'plugin.json'
];

export let marketplaceFilePaths = [
  '.agents/plugins/marketplace.json',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.github/plugin/marketplace.json'
];

export type CompatTarget = {
  kind: DestinationKind;
  destinationOid: bigint;
  destinationId: string;
  marketplaceId?: string;
  pluginId: string;
  pluginOid: bigint;
  pluginBase: string;
  skillBase: string;
  content: SkillContent;
  skillsBase: string;
  secondary?: Awaited<ReturnType<typeof addSecondarySkill>>;
  repository?: { repoId: string; skillRepositoryOid: bigint };
  expectedPaths: string[];
};

let withLogo = async (fixture: OrganizationFixture, origin: FakeOrigin, pluginId: string) =>
  await skillPluginService.updateSkillPlugin({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skillPlugin: await skillPluginService.getSkillPluginById({
      project: fixture.project,
      instance: fixture.instance,
      skillPluginId: pluginId
    }),
    input: { image: { type: 'url', url: origin.logoUrl() } }
  });

let addSecondarySkill = async (fixture: OrganizationFixture, pluginId: string) => {
  let skill = await createSkill(fixture, { name: uniqueId('Beta') });
  await addDocument(fixture, skill, '/SKILL.md', `# Beta\n\n${skill.id}`);
  await addDocument(fixture, skill, '/references/b.md', `b ${skill.id}`);
  let link = await addSkillToPlugin(fixture, {
    skillPluginId: pluginId,
    skillId: skill.id,
    pluginSkillSlug: 'beta'
  });
  return { skill, pluginSkillId: link.id, slug: link.pluginSkillSlug };
};

export let addSkillWithSlug = async (
  fixture: OrganizationFixture,
  pluginId: string,
  slug: string
) => {
  let skill = await createSkill(fixture, { name: uniqueId(slug) });
  await addDocument(fixture, skill, '/SKILL.md', `# ${slug}\n\n${skill.id}`);
  let link = await addSkillToPlugin(fixture, {
    skillPluginId: pluginId,
    skillId: skill.id,
    pluginSkillSlug: slug
  });
  return { skill, pluginSkillId: link.id, slug: link.pluginSkillSlug };
};

export let removePluginSkill = async (fixture: OrganizationFixture, pluginSkillId: string) =>
  await skillPluginSkillService.removeSkillPluginSkill({
    project: fixture.project,
    instance: fixture.instance,
    skillPluginSkill: await skillPluginSkillService.getSkillPluginSkillById({
      project: fixture.project,
      instance: fixture.instance,
      skillPluginSkillId: pluginSkillId
    })
  });

let linkedRepository = async (repoId: string) => {
  let repository = await db.skillRepository.findUniqueOrThrow({ where: { repoId } });
  return { repoId, skillRepositoryOid: repository.oid };
};

export let createCompatTarget = async (d: {
  fixture: OrganizationFixture;
  origin: FakeOrigin;
  kind: DestinationKind;
}): Promise<CompatTarget> => {
  let { fixture, origin, kind } = d;

  if (kind === 'managed') {
    let skill = await createSkill(fixture, { name: uniqueId('Managed') });
    let managed = await managedSkillPluginService.ensureManagedSkillPlugin({
      project: fixture.project,
      instance: fixture.instance,
      skillId: skill.id
    });
    let destination = await db.skillDestination.findUniqueOrThrow({
      where: { oid: managed.skillPlugin.destinationOid! }
    });

    // The stack worker runs with every flag on and may provision the managed plugin first; it
    // then starts out in manifest mode, so turn it into the legacy shape before any content.
    if (destination.storageMode === 'manifest') {
      let destinationOid = destination.oid;
      await eventually(async () => {
        expect(
          await db.skillDestinationSync.count({
            where: {
              destinationOid,
              status: { in: ['pending', 'processing', 'waiting_for_review'] }
            }
          })
        ).toBe(0);
      }, syncTimeout);
      let codeBucket = await originClient.codeBucket.create({
        tenantId: (await getOriginTenant(fixture.project)).id,
        purpose: 'cargo.skill.managed-plugin',
        isReadOnly: false
      });
      await db.skillDestinationFile.deleteMany({ where: { destinationOid } });
      await db.skillDestinationItem.deleteMany({ where: { destinationOid } });
      destination = await db.skillDestination.update({
        where: { oid: destinationOid },
        data: {
          storageMode: 'code_bucket',
          codeBucketId: codeBucket.id,
          currentManifestOid: null,
          storageModeChangedAt: null
        }
      });
    }

    await db.skillPlugin.update({
      where: { oid: managed.skillPlugin.oid },
      data: { image: { type: 'url', url: origin.logoUrl() } }
    });
    let content = await fillSkill(fixture, skill, 'Managed');
    let pluginSkill = await db.skillPluginSkill.findFirstOrThrow({
      where: { skillPluginOid: managed.skillPlugin.oid, skillOid: skill.oid }
    });

    return {
      kind,
      destinationOid: destination.oid,
      destinationId: destination.id,
      pluginId: managed.skillPlugin.id,
      pluginOid: managed.skillPlugin.oid,
      pluginBase: '',
      skillsBase: 'skills',
      skillBase: `skills/${pluginSkill.pluginSkillSlug}`,
      content,
      expectedPaths: [
        ...marketplaceFilePaths,
        ...pluginFilePaths(content.agent.slug),
        ...skillFilePaths.map(path => `skills/${pluginSkill.pluginSkillSlug}/${path}`)
      ]
    };
  }

  let content = await createSkillContent(
    fixture,
    kind === 'marketplace' ? 'Alpha M' : 'Alpha P'
  );

  if (kind === 'marketplace') {
    let marketplace = await createMarketplace(fixture);
    let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
    await withLogo(fixture, origin, plugin.id);
    let primary = await addSkillToPlugin(fixture, {
      skillPluginId: plugin.id,
      skillId: content.skill.id,
      pluginSkillSlug: 'alpha'
    });
    let secondary = await addSecondarySkill(fixture, plugin.id);
    let membership = await db.skillMarketplacePlugin.findFirstOrThrow({
      where: { skillMarketplaceOid: marketplace.oid, skillPluginOid: plugin.oid }
    });
    let pluginBase = `plugins/${membership.pluginSlug}`;

    let repoId = origin.addRepository({ owner: 'acme', name: uniqueId('marketplace') });
    await skillMarketplaceRepositoryService.createSkillMarketplaceRepository({
      project: fixture.project,
      instance: fixture.instance,
      skillMarketplaceId: marketplace.id,
      repoId
    });
    let destination = await db.skillDestination.findUniqueOrThrow({
      where: { oid: marketplace.destinationOid! }
    });

    return {
      kind,
      destinationOid: destination.oid,
      destinationId: destination.id,
      marketplaceId: marketplace.id,
      pluginId: plugin.id,
      pluginOid: plugin.oid,
      pluginBase,
      skillsBase: `${pluginBase}/skills`,
      skillBase: `${pluginBase}/skills/${primary.pluginSkillSlug}`,
      content,
      secondary,
      repository: await linkedRepository(repoId),
      expectedPaths: [
        ...marketplaceFilePaths,
        ...pluginFilePaths(content.agent.slug).map(path => `${pluginBase}/${path}`),
        ...skillFilePaths.map(
          path => `${pluginBase}/skills/${primary.pluginSkillSlug}/${path}`
        ),
        `${pluginBase}/skills/${secondary.slug}/SKILL.md`,
        `${pluginBase}/skills/${secondary.slug}/references/b.md`
      ]
    };
  }

  let plugin = await createPlugin(fixture);
  await withLogo(fixture, origin, plugin.id);
  let primary = await addSkillToPlugin(fixture, {
    skillPluginId: plugin.id,
    skillId: content.skill.id,
    pluginSkillSlug: 'alpha'
  });
  let secondary = await addSecondarySkill(fixture, plugin.id);

  let repoId = origin.addRepository({ owner: 'acme', name: uniqueId('plugin') });
  await skillPluginRepositoryService.createSkillPluginRepository({
    project: fixture.project,
    instance: fixture.instance,
    skillPluginId: plugin.id,
    repoId
  });
  let destination = await db.skillDestination.findUniqueOrThrow({
    where: { oid: plugin.destinationOid! }
  });

  return {
    kind,
    destinationOid: destination.oid,
    destinationId: destination.id,
    pluginId: plugin.id,
    pluginOid: plugin.oid,
    pluginBase: '',
    skillsBase: 'skills',
    skillBase: `skills/${primary.pluginSkillSlug}`,
    content,
    secondary,
    repository: await linkedRepository(repoId),
    expectedPaths: [
      ...marketplaceFilePaths,
      ...pluginFilePaths(content.agent.slug),
      ...skillFilePaths.map(path => `skills/${primary.pluginSkillSlug}/${path}`),
      `skills/${secondary.slug}/SKILL.md`,
      `skills/${secondary.slug}/references/b.md`
    ]
  };
};
