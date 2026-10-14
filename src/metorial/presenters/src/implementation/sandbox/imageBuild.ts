import { v } from '@lowerdeck/validation';
import { mapSandboxBuildFailure } from '@metorial/module-sandbox';
import { Presenter } from '@metorial/presenter';
import { sandboxImageBuildType } from '../../types';
import { sandboxBuildFailureSchema, toNumber } from './_shared';

export let v1SandboxImageBuildPresenter = Presenter.create(sandboxImageBuildType)
  .presenter(async ({ build }) => {
    let builder = build.regions.find(row => row.kind == 'builder');

    return {
      object: 'sandbox.image.build' as const,

      id: build.id,
      image_id: build.image.id,
      version_id: build.version.id,
      file_id: build.sourceFile?.id ?? null,
      status: build.status,
      failure: mapSandboxBuildFailure(
        build.failureCode
          ? { code: build.failureCode, message: build.failureMessage ?? '' }
          : null
      ),

      disk_size_bytes: toNumber(build.diskSizeBytes),

      regions: build.regions.map(row => ({
        region: row.region.identifier,
        status: row.status
      })),

      built_at: build.builtAt,
      ended_at: build.endedAt,
      created_at: build.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('sandbox.image.build', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The build's unique identifier" }),
      image_id: v.string({ description: 'The image the build produces a version of' }),
      version_id: v.string({ description: 'The image version the build produces' }),
      file_id: v.nullable(
        v.string({ description: 'The uploaded file holding the build context' })
      ),
      status: v.enumOf(
        [
          'preparing',
          'queued',
          'building',
          'processing',
          'replicating',
          'succeeded',
          'failed',
          'cancelled',
          'timed_out'
        ],
        { description: "The build's status" }
      ),
      failure: v.nullable(sandboxBuildFailureSchema),

      disk_size_bytes: v.number({ description: 'The size of disks created from the image' }),
      regions: v.array(
        v.object({
          region: v.string({ description: 'The region identifier' }),
          status: v.enumOf(
            [
              'pending',
              'preparing',
              'queued',
              'building',
              'copying',
              'awaiting_source',
              'processing',
              'succeeded',
              'failed',
              'cancelled',
              'timed_out'
            ],
            { description: "The build's progress in that region" }
          )
        }),
        { description: 'Build and replication progress per region' }
      ),
      has_logs: v.boolean({ description: 'Whether build logs are available' }),

      context_uploaded_at: v.nullable(
        v.date({ description: 'When the build context finished uploading' })
      ),
      built_at: v.nullable(v.date()),
      ended_at: v.nullable(v.date()),
      created_at: v.date()
    })
  )
  .build();
