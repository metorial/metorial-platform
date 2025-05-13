import { organizationService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { organizationGroup } from '../../middleware/organizationGroup';
import { organizationPresenter } from '../../presenters';

export let organizationManagementController = Controller.create(
  {
    name: 'Organization',
    description: 'Read and write organization information'
  },
  {
    get: organizationGroup
      .get(Path('/organization', 'management.organization.get'), {
        name: 'Get organization',
        description: 'Get the current organization information'
      })
      .output(organizationPresenter)
      .do(async ctx => {
        return organizationPresenter.present({ organization: ctx.organization });
      }),

    update: organizationGroup
      .patch(Path('/organization', 'management.organization.update'), {
        name: 'Update organization',
        description: 'Update the current organization information'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string())
        })
      )
      .output(organizationPresenter)
      .do(async ctx => {
        let organization = await organizationService.updateOrganization({
          input: {
            name: ctx.body.name
          },
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationPresenter.present({ organization });
      })
  }
);
