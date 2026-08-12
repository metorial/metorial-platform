import { v } from '@lowerdeck/validation';
import { instanceService } from '@metorial/module-organization';
import { usageService } from '@metorial/module-usage';
import { Controller, Path } from '@metorial/rest';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { usagePresenter } from '@metorial/presenters';

export let dashboardUsageController = Controller.create(
  {
    name: 'Usage',
    description: 'Get usage information'
  },
  {
    getTimeline: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/usage/timeline',
          'dashboard.usage.timeline'
        ),
        {
          name: 'Get organization',
          description: 'Get the current organization information'
        }
      )
      .query(
        'default',
        v.object({
          entities: v.array(v.object({ type: v.string(), id: v.optional(v.string()) })),
          from: v.date(),
          to: v.date(),
          interval: v.object({
            unit: v.union([v.literal('day'), v.literal('hour')]),
            count: v.number()
          })
        })
      )
      .output(usagePresenter)
      .do(async ctx => {
        let instances = await instanceService.getManyInstancesForOrganization({
          organization: ctx.organization
        });

        let timeline = await usageService.getUsageTimeline({
          owners: [
            { type: 'organization', id: ctx.organization.id },
            ...instances.map(i => ({ type: 'instance' as const, id: i.id }))
          ],
          entities: ctx.query.entities,
          from: ctx.query.from,
          to: ctx.query.to,
          interval: ctx.query.interval
        });

        return usagePresenter.present({ timeline });
      })
  }
);
