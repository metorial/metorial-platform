import type { ProviderSetupSession } from '@metorial-subspace/db';
import { env } from '../env';

export let getProviderSetupSessionPath = (
  setupSession: Pick<ProviderSetupSession, 'id' | 'clientSecret'>
) => `/setup-session/${setupSession.id}?client_secret=${setupSession.clientSecret}`;

export let getProviderSetupSessionUrl = (
  setupSession: Pick<ProviderSetupSession, 'id' | 'clientSecret'>
) =>
  `${env.service.INTEGRATIONS_UI_URL.replace(/\/+$/, '')}${getProviderSetupSessionPath(setupSession)}`;
