import { DashboardInstanceProvidersAuthMethodsListOutput } from '@metorial/dashboard-sdk';

export type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];

export let DIALOG_EXIT_MS = 220;

export let closeAndThen = (close: () => void, next?: () => void) => {
  close();
  if (!next) return;
  setTimeout(() => next(), DIALOG_EXIT_MS);
};

export let getAuthMethodHasSchema = (method: AuthMethod | undefined) => {
  let schema = method?.inputSchema?.schema;

  return !!(
    schema &&
    typeof schema === 'object' &&
    'type' in schema &&
    schema.type === 'object' &&
    'properties' in schema &&
    schema.properties &&
    typeof schema.properties === 'object' &&
    Object.keys(schema.properties).length > 0
  );
};

export let isSetupFlowAuthMethod = (method: AuthMethod | undefined) =>
  method?.type === 'oauth';

export let getCreateMethodDescription = (method: AuthMethod) => {
  if (isSetupFlowAuthMethod(method)) {
    return 'OAuth setup flow';
  }

  if (method.type === 'oauth') {
    return 'Manual credentials';
  }

  return 'Manual configuration';
};
