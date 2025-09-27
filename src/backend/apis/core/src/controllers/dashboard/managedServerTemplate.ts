import { managedServerTemplateService } from '@metorial/module-custom-server';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { apiGroup } from '../../middleware/apiGroup';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { managedServerTemplateTypePresenter } from '../../presenters';

export let managedServerGroup = apiGroup.use(async ctx => {
  if (!ctx.params.managedServerId) throw new Error('managedServerId is required');

  let managedServer = await managedServerTemplateService.getManagedServerTemplateById({
    templateId: ctx.params.managedServerId
  });

  return { managedServer };
});

export let dashboardManagedServerTemplateController = Controller.create(
  {
    name: 'Managed Server Template',
    description: 'Get managed server template information'
  },
  {
    list: apiGroup

      .get(
        Path(
          '/dashboard/organizations/:organizationId/managed-server-templates',
          'custom_servers.managed_server_templates.list'
        ),
        {
          name: 'List oauth connection templates',
          description: 'List all oauth connection templates'
        }
      )
      .use(isDashboardGroup())
      .outputList(managedServerTemplateTypePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await managedServerTemplateService.listManagedServerTemplates({});

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, managedServerTemplate =>
          managedServerTemplateTypePresenter.present({ managedServerTemplate })
        );
      }),

    get: managedServerGroup
      .get(
        Path(
          '/dashboard/organizations/:organizationId/managed-server-templates/:managedServerId',
          'custom_servers.managed_server_templates.get'
        ),
        {
          name: 'Get oauth connection template',
          description: 'Get the information of a specific oauth connection template'
        }
      )
      .use(isDashboardGroup())
      .output(managedServerTemplateTypePresenter)
      .do(async ctx => {
        return managedServerTemplateTypePresenter.present({
          managedServerTemplate: ctx.managedServer
        });
      })
  }
);
