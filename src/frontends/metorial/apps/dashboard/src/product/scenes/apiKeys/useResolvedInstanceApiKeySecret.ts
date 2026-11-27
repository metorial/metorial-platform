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

  return {
    apiKeys,
    secretApiKey: apiKeys.data?.find(isActiveSecretApiKey)
  };
};
