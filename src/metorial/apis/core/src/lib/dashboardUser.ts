import type { AuthInfo } from '@metorial/module-access';

export let isHumanDashboardUser = (auth: AuthInfo) =>
  auth.type == 'user' && !auth.machineAccess;
