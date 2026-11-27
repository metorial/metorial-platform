import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineAccessType } from '../../types';

export let v1SandboxMachineAccessPresenter = Presenter.create(sandboxMachineAccessType)
  .presenter(async ({ access, scope, ports }) => ({
    object: 'sandbox.machine.access' as const,

    token: access.token,
    scope,
    ports,

    urls: {
      type: scope,
      shell: scope === 'shell' ? access.urls.shell : null,
      exec: scope === 'shell' ? access.urls.exec : null,
      files: scope === 'files' ? access.urls.files : null,
      ports: scope === 'port' ? access.urls.ports : null
    },

    expires_at: access.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.access', {
        description: "String representing the object's type"
      }),

      token: v.string({
        description: 'The short-lived token that authorizes access. It is only shown once.'
      }),
      scope: v.enumOf(['shell', 'files', 'port'], {
        description: 'What the token grants access to'
      }),
      ports: v.nullable(v.union([v.array(v.number()), v.literal('*')])),
      urls: v.object({
        type: v.enumOf(['shell', 'files', 'port'], {
          description: 'What the token grants access to'
        }),
        shell: v.nullable(v.string({ description: 'The WebSocket URL of the shell' })),
        exec: v.nullable(
          v.string({
            description:
              'The WebSocket URL for running commands. Shell tokens authorize it alongside the shell.'
          })
        ),
        files: v.nullable(v.string({ description: 'The WebSocket URL of the file service' })),
        ports: v.nullable(
          v.record(v.string(), {
            description: 'The URL of each requested port, keyed by port number'
          })
        )
      }),
      expires_at: v.date({ description: 'When the token expires' })
    })
  )
  .build();
