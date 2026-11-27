export let getRegistrySlatePathParams = (slate: {
  slateFullIdentifierOnRegistry: string;
  slateScopeIdentifierOnRegistry: string;
  slateIdentifierOnRegistry: string;
}) => {
  let normalizedFullIdentifier = slate.slateFullIdentifierOnRegistry.startsWith('@')
    ? slate.slateFullIdentifierOnRegistry.slice(1)
    : slate.slateFullIdentifierOnRegistry;

  if (normalizedFullIdentifier.includes('/')) {
    let [scopeId, slateId] = normalizedFullIdentifier.split('/', 2);
    if (scopeId && slateId) {
      return { scopeId, slateId };
    }
  }

  return {
    scopeId: slate.slateScopeIdentifierOnRegistry,
    slateId: slate.slateIdentifierOnRegistry
  };
};
