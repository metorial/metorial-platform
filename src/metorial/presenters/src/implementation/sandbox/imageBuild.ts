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
      version_number: build.version.versionNumber,
      file_id: build.sourceFile?.id ?? null,
      status: build.status,
      failure: mapSandboxBuildFailure(
        build.failureCode
          ? { code: build.failureCode, message: build.failureMessage ?? '' }
          : null
      ),

      dockerfile_path: build.options?.dockerfilePath ?? null,
      context_path: build.options?.contextPath ?? null,
      target: build.options?.target ?? null,
      build_arg_names: build.options?.buildArgNames ?? null,
      timeout_seconds: build.options?.timeoutSeconds ?? null,
      disk_size_bytes: toNumber(build.diskSizeBytes),

      regions: build.regions.map(row => ({
        region: row.region.identifier,
        status: row.status
      })),
      has_logs: !!builder?.logStreamId,

      context_uploaded_at: build.contextUploadedAt,
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
      version_number: v.nullable(
        v.number({ description: 'The number of the produced version within its image' })
      ),
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

      dockerfile_path: v.nullable(
        v.string({
          description:
            'The Dockerfile used, relative to the build context. Null for builds started before build settings were recorded.'
        })
      ),
      context_path: v.nullable(
        v.string({
          description:
            'The directory inside the uploaded archive used as the build context. Null for builds started before build settings were recorded.'
        })
      ),
      target: v.nullable(v.string({ description: 'The Dockerfile stage that was built' })),
      build_arg_names: v.nullable(
        v.array(v.string(), {
          description:
            'The names of the build arguments passed to the build. Their values are not kept. Null for builds started before build settings were recorded.'
        })
      ),
      timeout_seconds: v.nullable(
        v.number({
          description:
            'How long the build may run. Null for builds started before build settings were recorded.'
        })
      ),
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
