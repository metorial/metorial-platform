export let providerVariantInclude = {
  backend: true,
  publisher: true,
  slate: true,
  currentVersion: { include: { specification: { omit: { value: true } } } },
  provider: true
};
