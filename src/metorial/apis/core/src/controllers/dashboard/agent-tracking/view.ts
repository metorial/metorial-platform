import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  agentTrackingViewEntity,
  agentTrackingViewPages,
  agentTrackingViewService,
  maxViewNameInputLength,
  maxViewNameLength,
  maxViewsPerPage,
  teamViewKinds,
  teamViewParamsValidator
} from '@metorial/module-agent-tracking-query';
import { agentTrackingViewPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { requireAgentTrackingEnabled } from '../../../middleware/requireAgentTrackingEnabled';
import { agentTrackingBasePath } from './readGroup';

let readScopes = ['instance.agent_tracking:read'] as const;
let writeScopes = ['instance.agent_tracking:write'] as const;

let viewsPath = `${agentTrackingBasePath}/views`;

let viewGroup = instanceGroup
  .use(isDashboardGroup())
  .use(requireAgentTrackingEnabled(agentTrackingViewEntity));

let singleViewGroup = viewGroup.use(async ctx => ({
  view: await agentTrackingViewService.getViewById({
    instance: ctx.instance,
    viewId: requireParam(ctx.params, 'viewId')
  })
}));

let nameField = (description: string) =>
  v.string({
    name: 'name',
    description,
    examples: ['High effort, last 30 days'],
    modifiers: [v.minLength(1), v.maxLength(maxViewNameInputLength)]
  });

let nameDescription = `Display name, 1 to ${maxViewNameLength} characters once surrounding spaces are removed and inner runs of spaces become one. Unique on the page, ignoring case.`;

let kindField = () =>
  v.enumOf(teamViewKinds, {
    name: 'kind',
    description:
      'Built-in view the saved view starts from. It sets the columns the page shows.'
  });

export let dashboardAgentTrackingViewController = Controller.create(
  {
    name: 'Agent Tracking Saved Views',
    description:
      'A saved view is a named set of agent usage page settings, such as range, sort and flag thresholds, shared with everyone who can read agent usage in the instance. It never contains members.',
    hideInDocs: true
  },
  {
    list: viewGroup
      .get(Path(viewsPath, 'dashboard.instance.agentTracking.views.list'), {
        name: 'List saved views',
        description:
          'Returns a paginated list of the saved views of the instance, oldest first. Available while individuals are hidden, since views contain no member data.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            page: v.optional(
              v.union(
                [v.enumOf(agentTrackingViewPages), v.array(v.enumOf(agentTrackingViewPages))],
                {
                  name: 'page',
                  description: 'Only return views of these agent usage pages.',
                  examples: ['team']
                }
              )
            )
          })
        )
      )
      .outputList(agentTrackingViewPresenter)
      .do(async ctx => {
        let paginator = await agentTrackingViewService.listViews({
          instance: ctx.instance,
          pages: normalizeArrayParam(ctx.query.page)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, view => agentTrackingViewPresenter.present({ view }));
      }),

    create: viewGroup
      .post(Path(viewsPath, 'dashboard.instance.agentTracking.views.create'), {
        name: 'Create saved view',
        description: `Creates a saved view. An instance can have at most ${maxViewsPerPage} saved views per page.`,
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          page: v.enumOf(agentTrackingViewPages, {
            name: 'page',
            description: 'Agent usage page the view belongs to.'
          }),
          name: nameField(nameDescription),
          kind: kindField(),
          params: teamViewParamsValidator
        })
      )
      .output(agentTrackingViewPresenter)
      .do(async ctx => {
        let view = await agentTrackingViewService.createView({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            page: ctx.body.page,
            name: ctx.body.name,
            kind: ctx.body.kind,
            params: ctx.body.params
          }
        });

        return agentTrackingViewPresenter.present({ view });
      }),

    get: singleViewGroup
      .get(Path(`${viewsPath}/:viewId`, 'dashboard.instance.agentTracking.views.get'), {
        name: 'Get saved view',
        description: 'Retrieves a saved view.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(agentTrackingViewPresenter)
      .do(async ctx => agentTrackingViewPresenter.present({ view: ctx.view })),

    update: singleViewGroup
      .patch(Path(`${viewsPath}/:viewId`, 'dashboard.instance.agentTracking.views.update'), {
        name: 'Update saved view',
        description:
          'Updates a saved view. Omitted fields keep their current value; `params` replaces the stored settings as a whole.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(nameField(nameDescription)),
          kind: v.optional(kindField()),
          params: v.optional(teamViewParamsValidator)
        })
      )
      .output(agentTrackingViewPresenter)
      .do(async ctx => {
        let view = await agentTrackingViewService.updateView({
          view: ctx.view,
          auditScope: ctx.auditScope,
          input: { name: ctx.body.name, kind: ctx.body.kind, params: ctx.body.params }
        });

        return agentTrackingViewPresenter.present({ view });
      }),

    delete: singleViewGroup
      .delete(Path(`${viewsPath}/:viewId`, 'dashboard.instance.agentTracking.views.delete'), {
        name: 'Delete saved view',
        description:
          'Deletes a saved view. It no longer appears in lists and its name can be used again. Deleted views cannot be restored.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(agentTrackingViewPresenter)
      .do(async ctx => {
        let view = await agentTrackingViewService.deleteView({
          view: ctx.view,
          auditScope: ctx.auditScope
        });

        return agentTrackingViewPresenter.present({ view });
      })
  }
);
