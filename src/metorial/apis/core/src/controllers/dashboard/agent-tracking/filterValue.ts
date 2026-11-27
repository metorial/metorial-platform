import { v } from '@lowerdeck/validation';
import {
  agentTrackingFilterValueService,
  filterFieldKeys,
  nameFilterValueValidator,
  requestRecordDays
} from '@metorial/module-agent-tracking-query';
import { agentTrackingFilterValuesPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { idFilter, rangeOf } from '../../../lib/agentTrackingParams';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { agentTrackingBasePath, agentTrackingReadGroup, rangeQueryFields } from './readGroup';

export let dashboardAgentTrackingFilterValueController = Controller.create(
  {
    name: 'Agent Tracking Filter Values',
    description:
      'The members, models, clients, seats, repositories, branches, tickets and providers a filter can choose from.',
    hideInDocs: true
  },
  {
    list: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/filter-values`,
          'dashboard.instance.agentTracking.filterValues.list'
        ),
        {
          name: 'List filter values',
          description: `Returns the values of one filter field that sent usage in a range, including members seen only in telemetry. Providers are those that coding agent tool calls in the range reached. Seats and providers need a range of at most ${requestRecordDays} days. With \`value\`, describes those values instead, without reading usage. Results can be up to a minute old.`,
          hideInDocs: true
        }
      )
      .query(
        'default',
        v.object({
          field: v.enumOf(filterFieldKeys, {
            name: 'field',
            description: 'The filter to list values for.'
          }),
          search: v.optional(
            v.string({
              name: 'search',
              description:
                'Only return values whose name, email, id, branch name or ticket key contains this text.',
              examples: ['ada'],
              modifiers: [v.maxLength(200)]
            })
          ),
          value: idFilter(
            'value',
            'Only describe these values, such as the ones a filter already holds, whether or not they sent usage. Their requests are null, and values that cannot be an id of field are left out. Leave out with search.',
            ['claude-sonnet-4-5', 'unknown'],
            nameFilterValueValidator
          ),
          ...rangeQueryFields
        })
      )
      .output(agentTrackingFilterValuesPresenter)
      .do(async ctx => {
        let filterValues = await agentTrackingFilterValueService.listFilterValues({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          field: ctx.query.field,
          canReadProviders:
            ctx.query.field == 'provider' && (await ctx.integrationsAccess.providers()),
          search: ctx.query.search,
          values: normalizeArrayParam(ctx.query.value),
          range: rangeOf(ctx.query)
        });

        return agentTrackingFilterValuesPresenter.present({ filterValues });
      })
  }
);
