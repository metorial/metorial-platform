export let integrationProviderVersionInclude = {
  deployment: true,
  authMethod: { include: { specification: { omit: { value: true } } } },
  authCredentials: true,
  config: true
};
