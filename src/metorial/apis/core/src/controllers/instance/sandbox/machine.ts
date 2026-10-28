import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  machineExecDefaultTimeoutSeconds,
  machineExecMaxTimeoutSeconds,
  sandboxMachineAccessService,
  sandboxMachineService
} from '@metorial/module-sandbox';
import {
  sandboxMachineAccessPresenter,
  sandboxMachineExecResultPresenter,
  sandboxMachinePresenter,
  sandboxMachineUsagePresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  lifecycleHookValidator,
  lifecyclePolicyValidator,
  mountValidator,
  runtimeValidator,
  toLifecycleHooksInput,
  toLifecyclePolicyInput,
  toMountsInput,
  toRuntimeInput
} from './_convert';
import {
  requirePathParam,
  sandboxInstanceGroup,
  sandboxReadScopes,
  sandboxWriteScopes
} from './_middleware';

export let sandboxMachineGroup = sandboxInstanceGroup.use(async ctx => {
  let machine = await sandboxMachineService.get({
    instance: ctx.instance,
    machineId: requirePathParam(ctx.params, 'machineId')
  });

  return { machine };
});

let machineStatusValidator = v.enumOf(['active', 'deleted']);

let machineStateValidator = v.enumOf([
  'starting',
  'running',
  'pausing',
  'paused',
  'resuming',
  'hibernating',
  'hibernated',
  'restarting',
  'upgrading',
  'terminating',
  'terminated',
  'failed'
]);

let accessTtlValidator = v.optional(
  v.number({ description: 'How long the token stays valid, in seconds' })
);

let specFields = {
  spec_id: v.optional(
    v.string({ description: 'The ID of the spec that sets the size of the machine' })
  ),
  spec_identifier: v.optional(
    v.string({
      description: 'The identifier of the spec that sets the size of the machine',
      examples: ['m3072-c3000']
    })
  ),
  memory_gib: v.optional(
    v.number({
      description:
        'The memory of the machine in GiB, in steps of 0.5. Use together with cpus instead of a spec ID.',
      examples: [3]
    })
  ),
  cpus: v.optional(
    v.number({
      description:
        'The CPUs of the machine, in steps of 0.5. Use together with memory_gib instead of a spec ID.',
      examples: [3]
    })
  )
};

let hasSpecSelector = (body: {
  spec_id?: string;
  spec_identifier?: string;
  memory_gib?: number;
  cpus?: number;
}) =>
  body.spec_id !== undefined ||
  body.spec_identifier !== undefined ||
  body.memory_gib !== undefined ||
  body.cpus !== undefined;

let toSpecSelector = (body: {
  spec_id?: string;
  spec_identifier?: string;
  memory_gib?: number;
  cpus?: number;
}) => ({
  specId: body.spec_id,
  specIdentifier: body.spec_identifier,
  memoryGib: body.memory_gib,
  cpus: body.cpus
});

export let sandboxMachineController = Controller.create(
  {
    name: 'Sandbox machines',
    description:
      'Create and operate sandbox machines. A machine boots from an image, can mount disks, and moves between running, paused, and hibernated states.'
  },
  {
    list: sandboxInstanceGroup
      .get(instancePath('sandbox/machines', 'sandbox.machines.list'), {
        name: 'List sandbox machines',
        description: 'Returns a paginated list of machines.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxMachinePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by resource IDs'
            }),
            status: v.optional(
              v.union([machineStatusValidator, v.array(machineStatusValidator)]),
              {
                description:
                  'Filter by whether the machine still exists (active) or was terminated (deleted). Defaults to active.'
              }
            ),
            state: v.optional(
              v.union([machineStateValidator, v.array(machineStateValidator)]),
              {
                description:
                  "Filter by the machine's current runtime status, the status field of the machine. Terminated machines are only listed together with status=deleted."
              }
            ),
            image_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by the image the machines boot from'
            }),
            region: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by the identifiers of the regions the machines run in'
            }),
            search: v.optional(
              v.string({ description: 'Search machines by name, slug, or ID' })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await sandboxMachineService.list({
          instance: ctx.instance,
          machineIds:
            ctx.query.id === undefined ? undefined : (normalizeArrayParam(ctx.query.id) ?? []),
          statuses: normalizeArrayParam(ctx.query.status),
          states: normalizeArrayParam(ctx.query.state),
          imageIds: normalizeArrayParam(ctx.query.image_id),
          regionIdentifiers: normalizeArrayParam(ctx.query.region),
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, machine =>
          sandboxMachinePresenter.present({ machine })
        );
      }),

    get: sandboxMachineGroup
      .get(instancePath('sandbox/machines/:machineId', 'sandbox.machines.get'), {
        name: 'Get sandbox machine',
        description: 'Retrieves a machine by ID.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxMachinePresenter)
      .do(async ctx => sandboxMachinePresenter.present({ machine: ctx.machine })),

    create: sandboxInstanceGroup
      .post(instancePath('sandbox/machines', 'sandbox.machines.create'), {
        name: 'Create sandbox machine',
        description: 'Creates a machine and, unless disabled, starts it.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          region: v.string({
            description: 'The identifier of the region to create the machine in'
          }),
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'User-defined metadata stored in Metorial. Replaces existing metadata when updated.'
            })
          ),
          name: v.optional(v.string({ description: 'A name for the machine' })),
          image_id: v.string({ description: 'The image to boot the machine from' }),
          ...specFields,
          lifecycle_policy: v.optional(lifecyclePolicyValidator),
          runtime: v.optional(v.nullable(runtimeValidator)),
          lifecycle_hooks: v.optional(v.nullable(v.array(lifecycleHookValidator))),
          ignore_image_hooks: v.optional(
            v.boolean({ description: "Ignore the image's own lifecycle hooks" })
          ),
          entrypoint_wait_seconds: v.optional(
            v.nullable(v.number({ description: 'How long startup waits for the entrypoint' }))
          ),
          mounts: v.optional(v.array(mountValidator)),
          firewall_ids: v.optional(
            v.array(v.string(), { description: 'Firewalls to apply to the machine' })
          ),
          public_ports: v.optional(
            v.array(v.number(), { description: 'Ports reachable without an access token' })
          ),
          start: v.optional(
            v.boolean({ description: 'Whether to start the machine right away' })
          )
        })
      )
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let machine = await sandboxMachineService.create({
          auditScope: ctx.auditScope,
          instance: ctx.instance,
          organization: ctx.organization,
          regionIdentifier: ctx.body.region,
          input: {
            metadata: ctx.body.metadata,
            name: ctx.body.name,
            imageId: ctx.body.image_id,
            spec: toSpecSelector(ctx.body),
            lifecyclePolicy: toLifecyclePolicyInput(ctx.body.lifecycle_policy),
            runtime: toRuntimeInput(ctx.body.runtime),
            lifecycleHooks: toLifecycleHooksInput(ctx.body.lifecycle_hooks),
            ignoreImageHooks: ctx.body.ignore_image_hooks,
            entrypointWaitSeconds: ctx.body.entrypoint_wait_seconds ?? 0,
            mounts: toMountsInput(ctx.body.mounts),
            firewallIds: ctx.body.firewall_ids,
            publicPorts: ctx.body.public_ports,
            start: ctx.body.start
          }
        });

        return sandboxMachinePresenter.present({ machine });
      }),

    update: sandboxMachineGroup
      .patch(instancePath('sandbox/machines/:machineId', 'sandbox.machines.update'), {
        name: 'Update sandbox machine',
        description:
          'Updates a machine. Changes to its size, runtime, or mounts take effect once the machine restarts, which happens on its own for a running machine, and the machine reports restart_required until then.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'User-defined metadata stored in Metorial. Replaces existing metadata when updated.'
            })
          ),
          name: v.optional(v.string({ description: 'A name for the machine' })),
          ...specFields,
          lifecycle_policy: v.optional(lifecyclePolicyValidator),
          runtime: v.optional(v.nullable(runtimeValidator)),
          lifecycle_hooks: v.optional(v.nullable(v.array(lifecycleHookValidator))),
          ignore_image_hooks: v.optional(
            v.boolean({ description: "Ignore the image's own lifecycle hooks" })
          ),
          entrypoint_wait_seconds: v.optional(
            v.nullable(v.number({ description: 'How long startup waits for the entrypoint' }))
          ),
          mounts: v.optional(v.array(mountValidator)),
          firewall_ids: v.optional(
            v.array(v.string(), { description: 'Firewalls to apply to the machine' })
          ),
          public_ports: v.optional(
            v.array(v.number(), { description: 'Ports reachable without an access token' })
          )
        })
      )
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let machine = await sandboxMachineService.update({
          auditScope: ctx.auditScope,
          machine: ctx.machine,
          organization: ctx.organization,
          input: {
            metadata: ctx.body.metadata,
            name: ctx.body.name,
            spec: hasSpecSelector(ctx.body) ? toSpecSelector(ctx.body) : undefined,
            lifecyclePolicy: toLifecyclePolicyInput(ctx.body.lifecycle_policy),
            runtime: toRuntimeInput(ctx.body.runtime),
            lifecycleHooks: toLifecycleHooksInput(ctx.body.lifecycle_hooks),
            ignoreImageHooks: ctx.body.ignore_image_hooks,
            entrypointWaitSeconds: ctx.body.entrypoint_wait_seconds,
            mounts: toMountsInput(ctx.body.mounts),
            firewallIds: ctx.body.firewall_ids,
            publicPorts: ctx.body.public_ports
          }
        });

        return sandboxMachinePresenter.present({ machine });
      }),

    delete: sandboxMachineGroup
      .delete(instancePath('sandbox/machines/:machineId', 'sandbox.machines.delete'), {
        name: 'Terminate sandbox machine',
        description: 'Terminates a machine and deletes its root disk.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let machine = await sandboxMachineService.terminate({
          auditScope: ctx.auditScope,
          machine: ctx.machine
        });

        return sandboxMachinePresenter.present({ machine });
      }),

    start: sandboxMachineGroup
      .post(instancePath('sandbox/machines/:machineId/start', 'sandbox.machines.start'), {
        name: 'Start sandbox machine',
        description: 'Starts a paused or hibernated machine.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let result = await sandboxMachineService.start({
          auditScope: ctx.auditScope,
          machine: ctx.machine
        });

        return sandboxMachinePresenter.present({
          machine: { ...ctx.machine, remote: result.remote }
        });
      }),

    pause: sandboxMachineGroup
      .post(instancePath('sandbox/machines/:machineId/pause', 'sandbox.machines.pause'), {
        name: 'Pause sandbox machine',
        description: 'Pauses a running machine and keeps its memory state.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let result = await sandboxMachineService.pause({
          auditScope: ctx.auditScope,
          machine: ctx.machine
        });

        return sandboxMachinePresenter.present({
          machine: { ...ctx.machine, remote: result.remote }
        });
      }),

    hibernate: sandboxMachineGroup
      .post(
        instancePath('sandbox/machines/:machineId/hibernate', 'sandbox.machines.hibernate'),
        {
          name: 'Hibernate sandbox machine',
          description: 'Hibernates a machine so it stops consuming compute resources.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let result = await sandboxMachineService.hibernate({
          auditScope: ctx.auditScope,
          machine: ctx.machine
        });

        return sandboxMachinePresenter.present({
          machine: { ...ctx.machine, remote: result.remote }
        });
      }),

    restart: sandboxMachineGroup
      .post(instancePath('sandbox/machines/:machineId/restart', 'sandbox.machines.restart'), {
        name: 'Restart sandbox machine',
        description: 'Restarts a machine on a fresh instance.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let result = await sandboxMachineService.restart({
          auditScope: ctx.auditScope,
          machine: ctx.machine
        });

        return sandboxMachinePresenter.present({
          machine: { ...ctx.machine, remote: result.remote }
        });
      }),

    touch: sandboxMachineGroup
      .post(instancePath('sandbox/machines/:machineId/touch', 'sandbox.machines.touch'), {
        name: 'Touch sandbox machine',
        description: 'Records activity so the machine is not paused for being idle.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxMachinePresenter)
      .do(async ctx => {
        let result = await sandboxMachineService.touch({ machine: ctx.machine });

        return sandboxMachinePresenter.present({
          machine: { ...ctx.machine, remote: result.machine.remote }
        });
      }),

    usage: sandboxMachineGroup
      .get(instancePath('sandbox/machines/:machineId/usage', 'sandbox.machines.usage'), {
        name: 'List sandbox machine usage',
        description: 'Returns resource usage samples of a machine, newest first.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxMachineUsagePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            machine_instance_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = sandboxMachineService.usage({
          machine: ctx.machine,
          instanceIds: normalizeArrayParam(ctx.query.machine_instance_id)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sample =>
          sandboxMachineUsagePresenter.present({ sample })
        );
      }),

    createShellAccess: sandboxMachineGroup
      .post(
        instancePath(
          'sandbox/machines/:machineId/access/shell',
          'sandbox.machines.access.shell'
        ),
        {
          name: 'Create shell access',
          description: 'Creates a short-lived token for an interactive shell in the machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body('default', v.object({ ttl_seconds: accessTtlValidator }))
      .output(sandboxMachineAccessPresenter)
      .do(async ctx => {
        let access = await sandboxMachineAccessService.createShellAccess({
          auditScope: ctx.auditScope,
          machine: ctx.machine,
          input: { ttlSeconds: ctx.body.ttl_seconds }
        });

        return sandboxMachineAccessPresenter.present({ access, scope: 'shell', ports: null });
      }),

    exec: sandboxMachineGroup
      .post(instancePath('sandbox/machines/:machineId/exec', 'sandbox.machines.exec'), {
        name: 'Run a command',
        description:
          'Runs a shell command in the machine and returns its exit code and output. Non-interactive; starts the machine if needed.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          command: v.string({
            description: 'The command to run with /bin/sh -c',
            examples: ['ls -la /tmp'],
            modifiers: [v.minLength(1)]
          }),
          cwd: v.optional(
            v.string({
              description: 'The working directory to run the command in',
              examples: ['/home/user']
            })
          ),
          env: v.optional(
            v.record(v.string(), {
              description: 'Environment variables to set for the command'
            })
          ),
          timeout_seconds: v.optional(
            v.number({
              description: `How long the command may run before it is stopped, in seconds. Defaults to ${machineExecDefaultTimeoutSeconds}, at most ${machineExecMaxTimeoutSeconds}.`,
              examples: [machineExecDefaultTimeoutSeconds],
              modifiers: [v.integer(), v.minValue(1), v.maxValue(machineExecMaxTimeoutSeconds)]
            })
          )
        })
      )
      .output(sandboxMachineExecResultPresenter)
      .do(async ctx => {
        // Exec can outlast the server idle timeout; it enforces its own deadline.
        ctx.setIdleTimeout?.(0);

        let result = await sandboxMachineAccessService.execCommand({
          auditScope: ctx.auditScope,
          machine: ctx.machine,
          signal: ctx.signal,
          input: {
            command: ctx.body.command,
            cwd: ctx.body.cwd,
            env: ctx.body.env,
            timeoutSeconds: ctx.body.timeout_seconds
          }
        });

        return sandboxMachineExecResultPresenter.present({ result });
      }),

    createFilesAccess: sandboxMachineGroup
      .post(
        instancePath(
          'sandbox/machines/:machineId/access/files',
          'sandbox.machines.access.files'
        ),
        {
          name: 'Create files access',
          description: "Creates a short-lived token for the machine's file service."
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body('default', v.object({ ttl_seconds: accessTtlValidator }))
      .output(sandboxMachineAccessPresenter)
      .do(async ctx => {
        let access = await sandboxMachineAccessService.createFilesAccess({
          auditScope: ctx.auditScope,
          machine: ctx.machine,
          input: { ttlSeconds: ctx.body.ttl_seconds }
        });

        return sandboxMachineAccessPresenter.present({ access, scope: 'files', ports: null });
      }),

    createPortAccess: sandboxMachineGroup
      .post(
        instancePath(
          'sandbox/machines/:machineId/access/ports',
          'sandbox.machines.access.ports'
        ),
        {
          name: 'Create port access',
          description: 'Creates a short-lived token for reaching ports inside the machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          ports: v.union([v.array(v.number()), v.literal('*')], {
            description: 'The ports the token grants access to, or "*" for all ports'
          }),
          ttl_seconds: accessTtlValidator
        })
      )
      .output(sandboxMachineAccessPresenter)
      .do(async ctx => {
        let access = await sandboxMachineAccessService.createPortAccess({
          auditScope: ctx.auditScope,
          machine: ctx.machine,
          input: { ports: ctx.body.ports, ttlSeconds: ctx.body.ttl_seconds }
        });

        return sandboxMachineAccessPresenter.present({
          access,
          scope: 'port',
          ports: ctx.body.ports
        });
      })
  }
);
