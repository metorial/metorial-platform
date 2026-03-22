import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { cliDeviceService } from '@metorial/module-machine-access';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { cliDevicePresenter } from '../../presenters';

let cliDeviceManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.cliDeviceId) {
    throw new ServiceError(
      badRequestError({
        message: 'cliDeviceId is required'
      })
    );
  }

  let cliDevice = await cliDeviceService.getCliDeviceById({
    organization: ctx.organization,
    cliDeviceId: ctx.params.cliDeviceId
  });

  return { cliDevice };
});

export let cliDeviceManagementController = Controller.create(
  {
    name: 'CLI Device',
    description: 'Inspect CLI devices for an organization'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('oauth/cli-devices', 'oauth.cliDevices.list'), {
        name: 'List organization CLI devices',
        description: 'Returns a paginated list of CLI devices for the organization.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:read'] }))
      .outputList(cliDevicePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await cliDeviceService.listCliDevices({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, cliDevice => cliDevicePresenter.present({ cliDevice }));
      }),

    get: cliDeviceManagementGroup
      .get(
        organizationManagementPath('oauth/cli-devices/:cliDeviceId', 'oauth.cliDevices.get'),
        {
          name: 'Get organization CLI device',
          description: 'Retrieves a specific CLI device for the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:read'] }))
      .output(cliDevicePresenter)
      .do(async ctx => {
        return cliDevicePresenter.present({
          cliDevice: ctx.cliDevice
        });
      })
  }
);
