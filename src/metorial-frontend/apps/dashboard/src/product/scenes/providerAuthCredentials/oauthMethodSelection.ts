type AuthMethod = {
  id: string;
  type: string;
};

export let resolveOAuthMethodState = <Method extends AuthMethod>({
  methods,
  selectedAuthMethodId,
  selectedAuthMethod,
  selectedAuthMethodLoading,
  providerLoading,
  deploymentLoading,
  authMethodsLoading
}: {
  methods: readonly Method[];
  selectedAuthMethodId?: string;
  selectedAuthMethod?: Method | null;
  selectedAuthMethodLoading: boolean;
  providerLoading: boolean;
  deploymentLoading: boolean;
  authMethodsLoading: boolean;
}) => {
  let hasSelectedAuthMethod = Boolean(selectedAuthMethodId);
  let oauthMethod = hasSelectedAuthMethod
    ? selectedAuthMethod?.id === selectedAuthMethodId && selectedAuthMethod?.type === 'oauth'
      ? selectedAuthMethod
      : undefined
    : methods.find(method => method.type === 'oauth');
  let isLoading = hasSelectedAuthMethod
    ? selectedAuthMethodLoading
    : providerLoading || deploymentLoading || authMethodsLoading;

  return {
    oauthMethod,
    isLoading,
    isUnavailable: !isLoading && oauthMethod === undefined
  };
};
