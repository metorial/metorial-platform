import { v } from '@lowerdeck/validation';
import { organizationService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { organizationGroup } from '../../../middleware/organizationGroup';
import { organizationPresenter } from '@metorial/presenters';

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
      .use(
        checkAccess({ possibleScopes: ['organization:read', 'consumer#organization:read'] })
      )
      .output(organizationPresenter)
      .do(async ctx => {
        return organizationPresenter.present({ organization: ctx.organization });
      }),

    update: organizationGroup
      .patch(Path('/organization', 'management.organization.update'), {
        name: 'Update organization',
        description: 'Update the current organization information'
      })
      .use(checkAccess({ possibleScopes: ['organization:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          image_file_id: v.optional(v.nullable(v.string()))
        })
      )
      .output(organizationPresenter)
      .do(async ctx => {
        let organization = await organizationService.updateOrganization({
          input: {
            name: ctx.body.name,
            imageFileId: ctx.body.image_file_id
          },
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return organizationPresenter.present({ organization });
      })
  }
);
