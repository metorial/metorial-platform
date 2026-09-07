import { ServiceError } from '@lowerdeck/error';

export let toSyncError = (error: unknown) => {
  if (error instanceof ServiceError) {
    return { code: error.data.code, message: error.data.message };
  }

  return {
    code: 'callback_sync_failed',
    message: error instanceof Error ? error.message : 'Unknown error'
  };
};
