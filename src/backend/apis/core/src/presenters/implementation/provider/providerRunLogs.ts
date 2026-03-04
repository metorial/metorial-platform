import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerRunLogsType } from '../../types';

export let v1ProviderRunLogsPresenter = Presenter.create(providerRunLogsType)
  .presenter(async ({ logs }) => ({
    object: 'session.provider_run.logs' as const,

    provider_run_id: logs.providerRunId,
    logs: logs.logs.map(log => ({
      object: 'session.provider_run.item' as const,
      timestamp: log.timestamp,
      message: log.message,
      output_type: log.outputType
    }))
  }))
  .schema(
    v.object({
      object: v.literal('session.provider_run.logs', {
        description: "String representing the object's type"
      }),
      provider_run_id: v.string({
        name: 'provider_run_id',
        description: 'Provider run ID',
        examples: ['prn_8hJkLmNpQrStUvWx']
      }),
      logs: v.array(
        v.object({
          object: v.literal('session.provider_run.item', {
            description: "String representing the object's type"
          }),
          timestamp: v.date({
            name: 'timestamp',
            description: 'Log timestamp',
            examples: [new Date('2025-09-15T10:30:00Z')]
          }),
          message: v.string({
            name: 'message',
            description: 'Log message content',
            examples: ['Server started on port 3000']
          }),
          output_type: v.enumOf(
            ['stdout', 'stderr', 'debug.info', 'debug.warning', 'debug.error'] as const,
            {
              name: 'output_type',
              description: 'Output type of the log entry'
            }
          )
        }),
        { name: 'logs', description: 'Array of log entries' }
      )
    })
  )
  .build();
