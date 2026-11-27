import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { cliDeviceType } from '../../types';
import { v1UserPresenter } from '../organization/user';

export let v1CliDevicePresenter = Presenter.create(cliDeviceType)
  .presenter(async ({ cliDevice }, opts) => ({
    object: 'machine_access.cli_device',
    id: cliDevice.id,
    ip: cliDevice.ip,
    organization_id: cliDevice.organization.id,
    oauth_authorization_id: cliDevice.oauthAuthorization.id,
    created_at: cliDevice.createdAt,
    updated_at: cliDevice.updatedAt,
    user: await v1UserPresenter.present({ user: cliDevice.user }, opts).run()
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.cli_device'),
      id: v.string(),
      ip: v.string(),
      organization_id: v.string(),
      oauth_authorization_id: v.string(),
      created_at: v.date(),
      updated_at: v.date(),
      user: v1UserPresenter.schema
    })
  )
  .build();
