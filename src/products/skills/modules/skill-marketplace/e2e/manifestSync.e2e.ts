import { hashBytes } from '@lowerdeck/hash/content';
import { ServiceError } from '@lowerdeck/error';
import { uniqueId } from '@metorial/e2e';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import { origin } from '@metorial/skills-scm-utils';
import { describe, expect, it } from 'vitest';
import {
  getManifestObjectKey,
  uploadManifestFile,
  writeManifestFile,
  type ManifestEntry
} from '../src/lib/manifestFile';
import { getMarketplaceManifestScope } from '../src/queues/sync/_lib/scope';
import { useFakeOrigin } from './_fixtures';

type ManifestRef = { bucket: string; key: string; sha256: string; entryCount: number };

let syncManifest = (payload: {
  tenantId: string;
  scmRepositoryId: string;
  requestKey: string;
  sourceKey: string;
  manifest: ManifestRef;
  previousManifest?: Omit<ManifestRef, 'entryCount'>;
}) => origin.scmRepository.syncManifest({ repositoryAccessMode: 'pull_request', ...payload });

let blobEntry = async (path: string, content: string): Promise<ManifestEntry> => {
  let hashes = hashBytes(content);
  let key = `skill-sync/blobs/sha256/${hashes.sha256}`;
  await getStorage().putObject(getCargoFilesBucketName(), key, content);

  return {
    path,
    gitBlobSha: hashes.gitBlobSha,
    sha256: hashes.sha256,
    size: hashes.size,
    crc32: hashes.crc32,
    key
  };
};

let storeManifest = async (destinationId: string, entries: ManifestEntry[]) =>
  await uploadManifestFile({
    destinationId,
    manifest: await writeManifestFile({
      destinationId,
      sourceBucket: getCargoFilesBucketName(),
      scope: getMarketplaceManifestScope(),
      entries
    })
  });

describe('fake Origin syncManifest', () => {
  let fakeOrigin = useFakeOrigin();

  it('records calls and reads their manifests back from object storage', async () => {
    let destinationId = uniqueId('sdst');
    let entries = [
      await blobEntry('plugins/acme/skills/qa/SKILL.md', `# QA ${destinationId}\n`),
      await blobEntry('.claude-plugin/marketplace.json', '{}\n')
    ];
    let previous = await storeManifest(destinationId, entries.slice(0, 1));
    let current = await storeManifest(destinationId, entries);

    expect(current.key).toBe(getManifestObjectKey({ destinationId, sha256: current.sha256 }));

    let sync = await syncManifest({
      tenantId: 'otn_e2e',
      scmRepositoryId: 'osr_e2e',
      requestKey: uniqueId('propagation'),
      sourceKey: destinationId,
      manifest: current,
      previousManifest: previous
    });
    expect(sync.status).toBe('merged');

    let [call] = fakeOrigin.syncManifestCalls().slice(-1);
    let manifest = await fakeOrigin.readManifest(call!);
    let previousManifest = await fakeOrigin.readPreviousManifest(call!);

    expect(manifest.header.destinationId).toBe(destinationId);
    expect(manifest.entries.map(entry => entry.path)).toEqual([
      '.claude-plugin/marketplace.json',
      'plugins/acme/skills/qa/SKILL.md'
    ]);
    expect(previousManifest?.entries.map(entry => entry.path)).toEqual([
      'plugins/acme/skills/qa/SKILL.md'
    ]);

    for (let entry of manifest.entries) {
      let object = await getStorage().getObject(getCargoFilesBucketName(), entry.key);
      expect(hashBytes(object.data)).toEqual({
        sha256: entry.sha256,
        gitBlobSha: entry.gitBlobSha,
        crc32: entry.crc32,
        size: entry.size
      });
    }
  });

  it('serves configured states, errors and later updates', async () => {
    let destinationId = uniqueId('sdst');
    let manifest = await storeManifest(destinationId, [
      await blobEntry('plugins/a/skills/x/SKILL.md', `# ${destinationId}\n`)
    ]);
    let request = (requestKey = uniqueId('propagation')) => ({
      tenantId: 'otn_e2e',
      scmRepositoryId: 'osr_e2e',
      requestKey,
      sourceKey: destinationId,
      manifest
    });
    let nextPollAt = new Date(Date.now() + 60_000);

    fakeOrigin.queueSyncManifestResponses(
      { status: 'waiting_for_review' },
      { status: 'syncing_contents', waitingReason: 'rate_limited', nextPollAt }
    );

    let waiting = await syncManifest(request('waiting'));
    expect(waiting.status).toBe('waiting_for_review');
    expect((await syncManifest(request('waiting'))).id).toBe(waiting.id);

    let rateLimited = await syncManifest(request());
    expect(rateLimited).toMatchObject({
      waitingReason: 'rate_limited',
      waitingUntil: nextPollAt
    });
    fakeOrigin.updateSync(rateLimited.id, { status: 'merged' });
    expect(fakeOrigin.getSync(rateLimited.id)).toMatchObject({
      waitingReason: null,
      waitingUntil: null
    });

    let killSwitchKey = uniqueId('propagation');
    fakeOrigin.queueSyncManifestResponses({
      rpcError: { status: 409, code: 'manifest_sync_disabled' }
    });
    let error = await syncManifest(request(killSwitchKey)).catch(error => error);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError<any>).data).toMatchObject({
      status: 409,
      code: 'manifest_sync_disabled'
    });
    expect(
      fakeOrigin.syncManifestCalls().filter(call => call.payload.requestKey === killSwitchKey)
    ).toHaveLength(1);

    fakeOrigin.updateSync(waiting.id, {
      status: 'cancelled',
      endReason: 'pull_request_closed'
    });
    let polled = await origin.scmRepositorySync.getMany({
      tenantId: 'otn_e2e',
      scmRepositorySyncIds: [waiting.id, 'osrs_missing']
    });
    expect(polled.syncs).toHaveLength(1);
    expect(polled.syncs[0]).toMatchObject({
      status: 'cancelled',
      endReason: 'pull_request_closed'
    });

    fakeOrigin.respondToSyncManifest({
      status: 'failed',
      errorCode: 'deletion_guard_tripped',
      errorDetails: { unexpectedDeletes: 300, paths: ['plugins/x/README.md'] }
    });
    let tripped = await syncManifest(request());
    expect(fakeOrigin.getSync(tripped.id)).toMatchObject({
      status: 'failed',
      errorCode: 'deletion_guard_tripped',
      errorMessage: 'deletion_guard_tripped'
    });
  });

  it('resets queued and default responses between tests', async () => {
    let destinationId = uniqueId('sdst');
    let manifest = await storeManifest(destinationId, [
      await blobEntry('plugins/a/skills/x/SKILL.md', `# ${destinationId}\n`)
    ]);

    let sync = await syncManifest({
      tenantId: 'otn_e2e',
      scmRepositoryId: 'osr_e2e',
      requestKey: uniqueId('propagation'),
      sourceKey: destinationId,
      manifest
    });

    expect(sync.status).toBe('merged');
  });

  it('can imitate an Origin without waiting fields', async () => {
    let destinationId = uniqueId('sdst');
    let manifest = await storeManifest(destinationId, [
      await blobEntry('plugins/a/skills/x/SKILL.md', `# ${destinationId}\n`)
    ]);
    fakeOrigin.respondToSyncManifest({
      status: 'syncing_contents',
      errorCode: 'rate_limited',
      nextPollAt: new Date(Date.now() + 60_000),
      omitWaitingFields: true
    });

    let sync = await syncManifest({
      tenantId: 'otn_e2e',
      scmRepositoryId: 'osr_e2e',
      requestKey: uniqueId('propagation'),
      sourceKey: destinationId,
      manifest
    });

    expect(sync).not.toHaveProperty('waitingReason');
    expect(sync).not.toHaveProperty('omitWaitingFields');
  });
});
