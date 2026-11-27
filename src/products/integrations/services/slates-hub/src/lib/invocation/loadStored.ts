import type { SlateInvocation } from '../../../prisma/generated/client';
import { getStoredInvocationStorageKey } from './store';
import type { StoredSlateInvocation } from './types';
import { invocationsBucketRecord, storage } from '../../storage';

export let loadStoredSlateInvocation = async (
  invocation: SlateInvocation
): Promise<StoredSlateInvocation | null> => {
  if (invocation.isPending) return null;

  try {
    let object = await storage.getObject(
      invocationsBucketRecord.bucket,
      getStoredInvocationStorageKey(invocation)
    );

    return JSON.parse(object.data.toString('utf-8')) as StoredSlateInvocation;
  } catch {
    return null;
  }
};
