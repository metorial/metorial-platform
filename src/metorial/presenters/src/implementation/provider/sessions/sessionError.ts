import { delay } from '@lowerdeck/delay';
import { v } from '@lowerdeck/validation';
import { db } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import { sessionErrorType } from '../../../types';

export let v1SessionErrorPresenter = Presenter.create(sessionErrorType)
  .presenter(async ({ sessionError }) => {
    try {
      let i = 0;
      while (sessionError.isProcessing || !sessionError.group) {
        if (i++ >= 10) break;

        await delay(250);

        let refreshedError = await db.sessionError.findUniqueOrThrow({
          where: { oid: sessionError.oid },
          include: { group: true }
        });
        sessionError = Object.assign(sessionError, refreshedError);
      }
    } catch (error) {
      console.error('Error refreshing session error for presenter', error);
    }

    return {
      object: 'session.error' as const,

      id: sessionError.id,

      code: sessionError.code,
      message: sessionError.message,
      // The former RPC returned null here despite the non-null API schema.
      data: sessionError.payload as Record<string, any>,
      status: sessionError.isProcessing ? ('processing' as const) : ('processed' as const),

      session_id: sessionError.session.id,
      provider_run_id: sessionError.providerRun?.id ?? null,
      connection_id: sessionError.connection?.id ?? null,

      group_id: sessionError.group?.id ?? null,
      similar_error_count: sessionError.group?.occurrenceCount ?? 0,

      created_at: sessionError.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('session.error', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session error identifier',
        examples: ['ser_6fGhJkLmNpQrStUv']
      }),
      code: v.string({
        name: 'code',
        description: 'Error code',
        examples: ['CONNECTION_TIMEOUT']
      }),
      message: v.string({
        name: 'message',
        description: 'Error message',
        examples: ['Connection timed out after 30 seconds']
      }),
      data: v.record(v.any(), {
        name: 'data',
        description: 'Error payload data',
        examples: [{ timeout_ms: 30000 }]
      }),
      status: v.enumOf(['processing', 'processed'], {
        name: 'status',
        description:
          'Indicates whether the error is still being processed or has been fully processed and grouped.'
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      provider_run_id: v.nullable(
        v.string({
          name: 'provider_run_id',
          description: 'Provider run ID',
          examples: ['prn_8hJkLmNpQrStUvWx']
        })
      ),
      connection_id: v.nullable(
        v.string({
          name: 'connection_id',
          description: 'Connection ID',
          examples: ['scn_8hJkLmNpQrStUvWx']
        })
      ),
      group_id: v.nullable(
        v.string({
          name: 'group_id',
          description: 'Error group ID',
          examples: ['seg_7gHjKlMnPqRsTuVw']
        })
      ),
      similar_error_count: v.number({
        name: 'similar_error_count',
        description: 'Count of similar errors in the group',
        examples: [5]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
