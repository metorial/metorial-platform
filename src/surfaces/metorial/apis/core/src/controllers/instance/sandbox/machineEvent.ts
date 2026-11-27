import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  sandboxMachineEventService,
  type SandboxMachineEventFilter
} from '@metorial/module-sandbox';
import { sandboxMachineEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { sandboxMachineEventTypes } from './_eventTypes';
import { requirePathParam, sandboxReadScopes } from './_middleware';
import { sandboxMachineGroup } from './machine';

let publicSources = ['agent', 'api', 'policy', 'guest', 'system'] as const;

let toInternalSources = (sources: (typeof publicSources)[number][] | undefined) =>
  sources?.flatMap(source =>
    source == 'system' ? (['platform', 'controller'] as const) : [source]
  ) as SandboxMachineEventFilter['sources'];

export let sandboxMachineEventController = Controller.create(
  {
    name: 'Sandbox machine events',
    description: 'The timeline of everything that happened to a machine and its instances.'
  },
  {
    list: sandboxMachineGroup
      .get(
        instancePath('sandbox/machines/:machineId/events', 'sandbox.machines.events.list'),
        {
          name: 'List machine events',
          description: 'Returns a paginated list of the events of a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxMachineEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            scope: v.optional(v.enumOf(['all', 'machine', 'instance']), {
              description:
                'Whether to include machine-level events, instance-level events, or both'
            }),
            machine_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only events of these instances'
            }),
            type: v.optional(
              v.union([
                v.enumOf([...sandboxMachineEventTypes]),
                v.array(v.enumOf([...sandboxMachineEventTypes]))
              ]),
              { description: 'Filter by event type' }
            ),
            source: v.optional(
              v.union([v.enumOf([...publicSources]), v.array(v.enumOf([...publicSources]))]),
              { description: 'Filter by what caused the event' }
            ),
            reverse: v.optional(v.boolean(), { description: 'List the oldest events first' })
          })
        )
      )
      .do(async ctx => {
        let paginator = sandboxMachineEventService.list({
          machine: ctx.machine,
          scope: ctx.query.scope,
          instanceIds: normalizeArrayParam(ctx.query.machine_instance_id),
          types: normalizeArrayParam(ctx.query.type),
          sources: toInternalSources(normalizeArrayParam(ctx.query.source)),
          reverse: ctx.query.reverse
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, event =>
          sandboxMachineEventPresenter.present({ event })
        );
      }),

    get: sandboxMachineGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/events/:eventId',
          'sandbox.machines.events.get'
        ),
        {
          name: 'Get machine event',
          description: 'Retrieves an event of a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxMachineEventPresenter)
      .do(async ctx => {
        let event = await sandboxMachineEventService.get({
          machine: ctx.machine,
          eventId: requirePathParam(ctx.params, 'eventId')
        });

        return sandboxMachineEventPresenter.present({ event });
      })
  }
);
