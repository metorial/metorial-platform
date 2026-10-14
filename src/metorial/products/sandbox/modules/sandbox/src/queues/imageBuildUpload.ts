import { db } from '@metorial/db';
import { fileService } from '@metorial/module-file';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { endImageBuild, terminalBuildStatuses } from '../lib/imageBuildEnd';
import { getRegionClient, getRegionUrl } from '../lib/regions';

let MAX_UPLOAD_ATTEMPTS = 5;
let UPLOAD_RETRY_DELAY_MS = 5000;
let UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

let isRetryableStatus = (status: number) => status == 408 || status == 429 || status >= 500;

export let imageBuildUploadQueue = createQueue<{ buildOid: string }>({
  name: 'sbx/image/build/upload',
  workerOpts: { concurrency: 5 },
  jobOpts: {
    attempts: MAX_UPLOAD_ATTEMPTS,
    backoff: { type: 'exponential', delay: UPLOAD_RETRY_DELAY_MS }
  }
});

export let imageBuildUploadQueueProcessor = imageBuildUploadQueue.process(
  async (data, job) => {
    let build = await db.sandboxMachineImageBuild.findFirst({
      where: {
        oid: BigInt(data.buildOid),
        status: { notIn: terminalBuildStatuses },
        contextUploadedAt: null
      },
      include: {
        sourceFile: true,
        regions: { include: { region: true, tenant: true }, orderBy: { oid: 'asc' } }
      }
    });
    if (!build) return;

    let fail = async (code: string, message: string) =>
      await endImageBuild({ build: build!, status: 'failed', failure: { code, message } });

    let builder = build.regions.find(row => row.kind == 'builder');
    if (!builder?.genesisImageId) {
      return await fail('upload_failed', 'The builder region is not ready.');
    }

    if (!build.sourceFile || build.sourceFile.status != 'active') {
      return await fail('context_unavailable', 'The build context file is unavailable.');
    }

    let isLastAttempt = job.attemptsMade + 1 >= MAX_UPLOAD_ATTEMPTS;

    try {
      let { upload } = await getRegionClient(builder.region.id).machineImage.build.create({
        tenantId: builder.tenant.id,
        imageId: builder.genesisImageId,
        idempotencyKey: build.id
      });

      if (upload) {
        let content = await fileService.downloadFileContent({ file: build.sourceFile });

        let response = await fetch(
          upload.url ?? new URL(upload.path, getRegionUrl(builder.region.id)).toString(),
          {
            method: upload.method,
            headers: { ...upload.headers, 'content-length': String(content.byteLength) },
            body: content,
            signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
          }
        );

        if (!response.ok) {
          let error = new Error(`Context upload failed with status ${response.status}`);
          if (!isRetryableStatus(response.status)) {
            return await fail('upload_failed', error.message);
          }

          throw error;
        }
      }

      await db.sandboxMachineImageBuild.updateMany({
        where: { oid: build.oid, contextUploadedAt: null },
        data: { contextUploadedAt: new Date() }
      });
    } catch (err) {
      if (isLastAttempt) return await fail('upload_failed', (err as Error).message);

      throw err;
    }
  }
);

export let imageBuildUploadProcessors = combineQueueProcessors([
  imageBuildUploadQueueProcessor
]);
