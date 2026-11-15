import { isServiceError } from '@lowerdeck/error';

export let ignoreNotFound = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (err) {
    if (isServiceError(err) && err.data.code == 'not_found') return;

    throw err;
  }
};
