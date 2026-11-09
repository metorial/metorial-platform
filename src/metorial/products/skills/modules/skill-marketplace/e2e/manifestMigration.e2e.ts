import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillDestinationStorageService } from '../src';
import { readStoredManifestFile } from '../src/lib/manifestFile/storage';
import { applyMarketplace } from '../src/serializers/marketplace';
import { applyPlugin } from '../src/serializers/plugin';
import { applySkill } from '../src/serializers/skill';
import {
  deleteMigratedSkillDestinationCodeBucket,
  migrateSkillDestinationToManifest
} from '../src/queues/storage';
import {
  performSkillSyncPropagation,
  startSkillSyncPropagation
} from '../src/queues/sync/propagate';
import { repairSkillRepository } from '../src/queues/sync/repair';
import {
  addDocument,
  addSkillToPlugin,
  captureFabric,
  createMarketplace,
  createPlugin,
  createSkill,
  holdSyncStageQueues,
  loadMarketplaceSerializerInput,
  runSerializer,
  useFakeOrigin,
  useSkillsManifestSyncFlag
} from './_fixtures';

let workerTimeout = { timeoutMs: 120_000, intervalMs: 1000 };
let day = 24 * 60 * 60 * 1000;

describe('manifest storage migration', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  useSkillsManifestSyncFlag(false);

  let fixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
  });

  let linkRepository = async (skillMarketplaceOid: bigint) => {
    let repository = await db.skillRepository.create({
      data: {
        id: await ID.generateId('skillRepository'),
        repoId: origin.addRepository({ owner: 'acme', name: uniqueId('skills') }),
        projectOid: fixture.project.oid,
        instanceOid: fixture.instance.oid,
        deletionsAppliedAt: new Date()
      }
    });
    await db.skillMarketplaceRepository.create({
      data: {
        id: await ID.generateId('skillMarketplaceRepository'),
        skillMarketplaceOid,
        skillRepositoryOid: repository.oid
      }
    });
    return repository;
  };

  let signatureFor = (content: string) =>
    content.startsWith('storage:')
      ? `file:${content.slice('storage:'.length)}`
      : `sha256:${createHash('sha256').update(content).digest('hex')}`;

  // Seeds the state a completed code-bucket sync leaves behind: the item hashes and one
  // SkillDestinationFile row per serializer output path.
  let setupLegacyDestination = async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Migrate Skill') });
    await addDocument(fixture, skill, '/SKILL.md', `# Migrate\n\n${skill.id}`);
    await addDocument(fixture, skill, '/references/notes.md', 'notes');

    let marketplace = await createMarketplace(fixture);
    let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
    await addSkillToPlugin(fixture, {
      skillPluginId: plugin.id,
      skillId: skill.id,
      pluginSkillSlug: 'migrate-skill'
    });

    let destination = await db.skillDestination.update({
      where: { oid: marketplace.destinationOid! },
      data: { syncRecoveryVersion: 1 }
    });
    expect(destination.storageMode).toBe('code_bucket');
    expect(destination.codeBucketId).not.toBeNull();

    let input = await loadMarketplaceSerializerInput(marketplace.id);
    let pluginInput = input.plugins[0]!;
    let skillInput = pluginInput.skills[0]!;
    let outputs = [
      {
        itemKey: `marketplace:${marketplace.id}`,
        item: { skillMarketplaceOid: marketplace.oid },
        output: await runSerializer(applyMarketplace, {
          skillMarketplace: input.skillMarketplace
        })
      },
      {
        itemKey: `plugin:${plugin.id}`,
        item: { skillPluginOid: pluginInput.skillPlugin.oid },
        output: await runSerializer(applyPlugin, {
          skillPlugin: pluginInput.skillPlugin,
          skillMarketplace: input.skillMarketplace,
          skillMarketplacePlugin: pluginInput.skillMarketplacePlugin
        })
      },
      {
        itemKey: `skill:${skill.id}:${plugin.id}`,
        item: { skillOid: skillInput.skill.oid, skillPluginOid: pluginInput.skillPlugin.oid },
        output: await runSerializer(applySkill, skillInput)
      }
    ];

    for (let { itemKey, item, output } of outputs) {
      await db.skillDestinationItem.create({
        data: { destinationOid: destination.oid, hash: 'legacy', ...item }
      });
      await db.skillDestinationFile.createMany({
        data: [...output.files].map(([path, content]) => ({
          destinationOid: destination.oid,
          path,
          signature: signatureFor(content),
          itemKey
        }))
      });
    }

    await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: destination.oid,
        status: 'completed',
        storageMode: 'code_bucket',
        isAtRepoSyncStage: true,
        startedAt: new Date(),
        completedAt: new Date()
      }
    });
    let repository = await linkRepository(marketplace.oid);

    let legacyPaths = outputs.flatMap(({ output }) => output.paths()).sort();

    return { marketplace, destination, repository, legacyPaths };
  };

  let migrate = (destinationId: string) =>
    migrateSkillDestinationToManifest({ destinationId, requestedBy: 'ops' });

  it('migrates a quiet legacy destination and publishes the same paths from a manifest', async () => {
    let { destination, legacyPaths } = await setupLegacyDestination();
    let audit = captureFabric('skill.destination.audit.storage_migrated:after');

    await eventually(async () => {
      expect(await migrate(destination.id)).toEqual({ status: 'migrated' });
    }, workerTimeout);
    audit.stop();

    let migrated = await db.skillDestination.findUniqueOrThrow({
      where: { oid: destination.oid }
    });
    expect(migrated).toMatchObject({
      storageMode: 'manifest',
      storageModeChangedAt: expect.any(Date),
      codeBucketId: destination.codeBucketId
    });
    expect(
      await db.skillDestinationItem.findMany({
        where: { destinationOid: destination.oid },
        select: { hash: true }
      })
    ).toEqual([{ hash: '' }, { hash: '' }, { hash: '' }]);
    expect(audit.events).toEqual([expect.objectContaining({ requestedBy: 'ops' })]);

    let migrationSync = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: destination.oid, trigger: 'migration' }
    });

    await eventually(async () => {
      let sync = await db.skillDestinationSync.findUniqueOrThrow({
        where: { oid: migrationSync.oid },
        include: { manifest: true }
      });
      expect(sync.manifest).not.toBeNull();
    }, workerTimeout);

    let { manifest } = await db.skillDestinationSync.findUniqueOrThrow({
      where: { oid: migrationSync.oid },
      include: { manifest: true }
    });
    let stored = await readStoredManifestFile({
      key: manifest!.objectKey,
      sha256: manifest!.sha256
    });
    expect(stored.entries.map(entry => entry.path).sort()).toEqual(legacyPaths);
  });

  it('keeps a destination on code-bucket storage while a repository still owes deletes', async () => {
    let { destination, repository } = await setupLegacyDestination();
    await db.skillDestinationDeletedFile.create({
      data: {
        destinationOid: destination.oid,
        path: 'plugins/removed/SKILL.md',
        createdAt: new Date(repository.deletionsAppliedAt!.getTime() + 1000)
      }
    });

    expect(await migrate(destination.id)).toEqual({
      status: 'blocked',
      reason: 'deletes_owed'
    });
    expect(
      (await db.skillDestination.findUniqueOrThrow({ where: { oid: destination.oid } }))
        .storageMode
    ).toBe('code_bucket');
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: destination.oid, trigger: 'migration' }
      })
    ).toBe(0);

    await db.skillRepository.update({
      where: { oid: repository.oid },
      data: { deletionsAppliedAt: new Date(Date.now() + 2000) }
    });
    await eventually(async () => {
      expect(await migrate(destination.id)).toEqual({ status: 'migrated' });
    }, workerTimeout);
  });

  it('keeps a destination on code-bucket storage while a sync is running', async () => {
    let { destination } = await setupLegacyDestination();
    await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: destination.oid,
        status: 'processing',
        storageMode: 'code_bucket'
      }
    });

    expect(await migrate(destination.id)).toEqual({
      status: 'blocked',
      reason: 'sync_active'
    });
  });

  it('demotes a manifest destination to a fresh code bucket with a full legacy sync', async () => {
    let marketplace = await createMarketplace(fixture);
    let destination = await db.skillDestination.update({
      where: { oid: marketplace.destinationOid! },
      data: {
        storageMode: 'manifest',
        storageModeChangedAt: new Date(),
        syncRecoveryVersion: 1
      }
    });
    await db.skillDestinationItem.create({
      data: {
        destinationOid: destination.oid,
        skillMarketplaceOid: marketplace.oid,
        hash: 'x'
      }
    });
    await db.skillDestinationFile.create({
      data: {
        destinationOid: destination.oid,
        path: '.claude-plugin/marketplace.json',
        signature: 'git:abc',
        itemKey: `marketplace:${marketplace.id}`
      }
    });
    let audit = captureFabric('skill.destination.audit.storage_demoted:after');

    let demoted = await skillDestinationStorageService.demoteSkillDestinationToCodeBucket({
      skillDestinationId: destination.id,
      auditScope: fixture.auditScope
    });
    audit.stop();

    expect(demoted.storageMode).toBe('code_bucket');
    expect(demoted.codeBucketId).not.toBe(destination.codeBucketId);
    expect(origin.bucketCreation(demoted.codeBucketId)).toBeDefined();
    expect(
      await db.skillDestinationFile.findMany({
        where: { destinationOid: destination.oid },
        select: { signature: true }
      })
    ).toEqual([{ signature: '' }]);
    expect(
      await db.skillDestinationItem.findMany({
        where: { destinationOid: destination.oid },
        select: { hash: true }
      })
    ).toEqual([{ hash: '' }]);
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: destination.oid, trigger: 'migration' }
      })
    ).toBe(1);
    expect(audit.events).toEqual([
      expect.objectContaining({ previousCodeBucketId: destination.codeBucketId })
    ]);

    expect(
      await migrateSkillDestinationToManifest({
        destinationId: destination.id,
        requestedBy: 'cron'
      })
    ).toEqual({ status: 'blocked', reason: 'demoted' });
  });

  let setupRetainedCodeBucket = async (propagationStatus: 'processing' | 'completed') => {
    let { destination, repository } = await setupLegacyDestination();
    let migratedAt = new Date(Date.now() - 20 * day);
    let completedAt = new Date(Date.now() - 15 * day);
    await db.skillDestination.update({
      where: { oid: destination.oid },
      data: { storageMode: 'manifest', storageModeChangedAt: migratedAt }
    });
    let manifest = await db.skillDestinationManifest.create({
      data: {
        id: await ID.generateId('skillDestinationManifest'),
        sha256: uniqueId('sha'),
        objectKey: 'unused',
        formatVersion: 1,
        entryCount: 0,
        totalBytes: 0n,
        destinationOid: destination.oid
      }
    });
    let sync = await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: destination.oid,
        status: 'completed',
        storageMode: 'manifest',
        manifestOid: manifest.oid,
        completedAt
      }
    });
    let propagation = await db.skillDestinationSyncRepositoryPropagation.create({
      data: {
        id: await ID.generateId('skillDestinationSyncRepositoryPropagation'),
        status: propagationStatus,
        completedAt: propagationStatus === 'completed' ? completedAt : null,
        manifestOid: manifest.oid,
        skillDestinationSyncOid: sync.oid,
        skillRepositoryOid: repository.oid,
        branchName: 'metorial/sync',
        prName: 'Sync marketplace'
      }
    });

    let bucketCalls = (name: string) =>
      origin
        .callsTo(name)
        .filter(call => call.payload.codeBucketId === destination.codeBucketId);
    let codeBucketIdOf = async () =>
      (await db.skillDestination.findUniqueOrThrow({ where: { oid: destination.oid } }))
        .codeBucketId;

    return { destination, propagation, completedAt, bucketCalls, codeBucketIdOf };
  };

  it('deletes the code bucket contents 14 days after every repository synced from a manifest', async () => {
    let { destination, propagation, completedAt, bucketCalls, codeBucketIdOf } =
      await setupRetainedCodeBucket('processing');

    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: destination.id })
    ).toBe(false);

    await db.skillDestinationSyncRepositoryPropagation.update({
      where: { oid: propagation.oid },
      data: { status: 'completed', completedAt }
    });
    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: destination.id })
    ).toBe(true);

    expect(bucketCalls('codeBucket:delete')).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ tenantId: expect.any(String) })
      })
    ]);
    expect(bucketCalls('codeBucket:deletePath')).toEqual([]);
    expect(await codeBucketIdOf()).toBeNull();
  });

  it('keeps the code bucket while Origin still exports it and deletes it on a later run', async () => {
    let { destination, bucketCalls, codeBucketIdOf } =
      await setupRetainedCodeBucket('completed');
    origin.setCodeBucketInUse(destination.codeBucketId!, true);

    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: destination.id })
    ).toBe(false);
    expect(bucketCalls('codeBucket:delete')).toEqual([
      expect.objectContaining({
        result: expect.objectContaining({ code: 'code_bucket_in_use' })
      })
    ]);
    expect(await codeBucketIdOf()).toBe(destination.codeBucketId);

    origin.setCodeBucketInUse(destination.codeBucketId!, false);
    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: destination.id })
    ).toBe(true);
    expect(bucketCalls('codeBucket:delete')).toHaveLength(2);
    expect(await codeBucketIdOf()).toBeNull();
  });

  it('leaves legacy destinations on the code-bucket path', async () => {
    holdSyncStageQueues();
    let marketplace = await createMarketplace(fixture, {
      repositoryAccessMode: 'default_branch'
    });
    let destination = await db.skillDestination.update({
      where: { oid: marketplace.destinationOid! },
      data: { syncRecoveryVersion: 1, isDirty: false, shouldFlushAt: null, mustFlushAt: null }
    });
    expect(destination.storageMode).toBe('code_bucket');
    let repository = await linkRepository(marketplace.oid);

    let sync = await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: destination.oid,
        status: 'processing',
        storageMode: 'code_bucket',
        startedAt: new Date(),
        prName: 'Sync marketplace'
      }
    });
    await startSkillSyncPropagation({ skillDestinationSyncId: sync.id, contentVersion: 0 });
    let propagation = await db.skillDestinationSyncRepositoryPropagation.findFirstOrThrow({
      where: { skillDestinationSyncOid: sync.oid }
    });
    expect(propagation).toMatchObject({ manifestOid: null, deletionsUpTo: expect.any(Date) });

    await performSkillSyncPropagation({
      skillDestinationSyncId: sync.id,
      processedPropagationIds: [],
      pendingPropagationIds: [propagation.id]
    });

    let [legacyCall] = origin
      .callsTo('scmRepository:syncCodeBucket')
      .filter(call => call.payload.codeBucketId === destination.codeBucketId);
    expect(legacyCall?.payload).toMatchObject({
      scmRepositoryId: repository.repoId,
      explicitDeletesOnly: true,
      requestKey: propagation.id
    });
    expect(
      origin.syncManifestCalls().filter(call => call.payload.sourceKey === destination.id)
    ).toHaveLength(0);

    await db.skillRepository.update({
      where: { oid: repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: repository.id });
    expect(
      (await db.skillRepository.findUniqueOrThrow({ where: { oid: repository.oid } }))
        .nextRepairAt
    ).toBeNull();
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: destination.oid, trigger: 'repair' }
      })
    ).toBe(0);
  });

  it('skips demoted destinations in an organization-wide migration unless one is named', async () => {
    let { destination: legacy } = await setupLegacyDestination();
    let demotedMarketplace = await createMarketplace(fixture);
    let demoted = await eventually(async () => {
      expect(
        await db.skillDestinationSync.count({
          where: {
            destinationOid: demotedMarketplace.destinationOid!,
            status: { notIn: ['completed'] }
          }
        })
      ).toBe(0);
      return await db.skillDestination.update({
        where: { oid: demotedMarketplace.destinationOid! },
        data: {
          syncRecoveryVersion: 1,
          storageModeChangedAt: new Date(Date.now() - day),
          isDirty: false,
          shouldFlushAt: null,
          mustFlushAt: null
        }
      });
    }, workerTimeout);
    expect(demoted.storageMode).toBe('code_bucket');

    expect(
      await skillDestinationStorageService.migrateSkillDestinationStorage({
        organizationId: org.ids.organizationId
      })
    ).toEqual({ enqueued: 'organization' });
    await eventually(async () => {
      expect(
        (await db.skillDestination.findUniqueOrThrow({ where: { oid: legacy.oid } }))
          .storageMode
      ).toBe('manifest');
    }, workerTimeout);

    expect(
      await db.skillDestination.findUniqueOrThrow({ where: { oid: demoted.oid } })
    ).toMatchObject({
      storageMode: 'code_bucket',
      storageModeChangedAt: demoted.storageModeChangedAt
    });
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: demoted.oid, trigger: 'migration' }
      })
    ).toBe(0);

    expect(
      await skillDestinationStorageService.migrateSkillDestinationStorage({
        skillDestinationId: demoted.id
      })
    ).toEqual({ enqueued: 'destination' });
    await eventually(async () => {
      expect(
        (await db.skillDestination.findUniqueOrThrow({ where: { oid: demoted.oid } }))
          .storageMode
      ).toBe('manifest');
    }, workerTimeout);
  });
});
