import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerRunLogsType } from '../../types';

export let v1ProviderRunLogsPresenter = Presenter.create(providerRunLogsType)
  .presenter(async ({ logs }) => ({
    object: 'session.provider_run.logs' as const,
    logs: logs.logs.map(log => ({
      type: log.type,
      line: log.line,
      timestamp: log.timestamp ?? null
    }))
  }))
  .schema(
    v.object({
      object: v.literal('session.provider_run.logs', {
        description: "String representing the object's type"
      }),
      logs: v.array(
        v.object({
          type: v.string({
            name: 'type',
            description: 'Log type',
            examples: ['stdout', 'stderr']
          }),
          line: v.string({
            name: 'line',
            description: 'Log line content',
            examples: ['Server started on port 3000']
          }),
          timestamp: v.nullable(
            v.date({
              name: 'timestamp',
              description: 'Log timestamp',
              examples: [new Date('2025-09-15T10:30:00Z')]
            })
          )
        }),
        { name: 'logs', description: 'Array of log entries' }
      )
    })
  )
  .build();
