import { useRevealedApiKey } from '@metorial/state';
import { useEffect, useState } from 'react';
import { useApiKeysWithAutoInit } from './useApiKeysWithAutoInit';

let isActiveSecretApiKey = (d: {
  type: string;
  status: string;
  revealInfo?: { forever?: boolean; until?: Date } | null;
}) =>
  d.type === 'instance_access_token_secret' &&
  d.status === 'active' &&
  (d.revealInfo?.forever || (d.revealInfo?.until ? d.revealInfo.until > new Date() : false));

export let useResolvedInstanceApiKeySecret = (instanceId: string | null | undefined) => {
  let apiKeys = useApiKeysWithAutoInit(
    instanceId
      ? {
          type: 'instance_access_token',
          instanceId
        }
      : undefined
  );

  let secretApiKey = apiKeys.data?.find(isActiveSecretApiKey);
  let revealedApiKey = useRevealedApiKey({ apiKeyId: secretApiKey?.id });
  let [apiKeySecret, setApiKeySecret] = useState<string | undefined>(
    () => revealedApiKey.value ?? secretApiKey?.secret ?? undefined
  );

  useEffect(() => {
    if (revealedApiKey.value) {
      setApiKeySecret(revealedApiKey.value);
      return;
    }

    if (secretApiKey?.secret) {
      setApiKeySecret(secretApiKey.secret);
    }
  }, [revealedApiKey.value, secretApiKey?.secret]);

  return {
    apiKeys,
    apiKeySecret,
    revealedApiKey,
    secretApiKey,
    setApiKeySecret
  };
};
