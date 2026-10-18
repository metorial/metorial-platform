import { isServiceError } from '@lowerdeck/error';

let INTEGRATION_INSTANCE_ID_PREFIX = 'ini_';

export let isIntegrationInstanceUnavailableError = (error: unknown) => {
  if (!isServiceError(error)) return false;

  let data = error.data as { code?: string; entity?: string; entityId?: string };

  if (data.code === 'integration_instance_not_active') return true;
  if (data.code === 'not_found') return data.entity === 'integration.instance';

  return (
    data.code === 'use_after_delete' &&
    typeof data.entityId === 'string' &&
    data.entityId.startsWith(INTEGRATION_INSTANCE_ID_PREFIX)
  );
};
