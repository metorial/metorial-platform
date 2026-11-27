export let integrationProviderVersionInclude = {
  deployment: true,
  authMethod: { include: { specification: { omit: { value: true } } } },
  authCredentials: true,
  config: true
} as const;

let specificationAuthMethodsSelect = {
  select: {
    specification: {
      select: {
        providerAuthMethods: {
          select: {
            id: true,
            globalOid: true,
            specId: true,
            specUniqueIdentifier: true,
            key: true,
            callableId: true,
            type: true,
            isDefault: true,
            createdAt: true,
            value: true
          }
        }
      }
    }
  }
} as const;

// Only for presented versions: the auth method presenter needs the deployment's provider
// versions to resolve effective capabilities.
export let integrationProviderVersionPresentableInclude = {
  ...integrationProviderVersionInclude,
  deployment: {
    include: {
      currentVersion: {
        select: {
          lockedVersionOid: true,
          lockedVersion: specificationAuthMethodsSelect
        }
      },
      provider: {
        select: {
          defaultVariantOid: true,
          hasEnvironments: true,
          defaultVariant: {
            select: { currentVersion: specificationAuthMethodsSelect }
          }
        }
      }
    }
  }
} as const;
