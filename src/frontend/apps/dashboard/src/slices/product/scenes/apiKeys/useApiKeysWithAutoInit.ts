import { ApiKeysFilter, useApiKeys, useCurrentInstance } from '@metorial/state';
import { useEffect, useRef, useState } from 'react';

export let useApiKeysWithAutoInit = (filter: ApiKeysFilter | undefined | null) => {
  let apiKeys = useApiKeys(filter);
  let currentInstance = useCurrentInstance();

  let initializingRef = useRef<string>(undefined);
  let createApplication = apiKeys.createMutator();
  let [creatingInitialApplication, setCreatingInitialApplication] = useState(false);
  useEffect(() => {
    if (!filter) return;

    if (
      filter.type === 'instance_access_token' &&
      !apiKeys.error &&
      !apiKeys.isLoading &&
      !apiKeys.data?.length &&
      initializingRef.current !== filter.instanceId &&
      currentInstance.data?.id == filter.instanceId &&
      currentInstance.data?.type == 'development'
    ) {
      setCreatingInitialApplication(true);

      initializingRef.current = filter.instanceId;

      createApplication
        .mutate({
          name: 'Default Token',
          instanceId: filter.instanceId,
          type: 'instance_access_token_secret'
        })
        .finally(() => {
          setCreatingInitialApplication(false);
        });
    }
  }, [
    (filter as any)?.instanceId,
    apiKeys.error,
    apiKeys.isLoading,
    apiKeys.data?.length,
    currentInstance.data?.id
  ]);

  return {
    ...apiKeys,
    creatingInitialApplication
  };
};
