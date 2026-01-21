import { AuthInfo } from '@metorial/module-access';
import { Group } from '@metorial/rest';

export let providerApiGroup = Group.create<AuthInfo>().use(async ctx => {
  return {};
});
