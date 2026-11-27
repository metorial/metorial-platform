import { type Prisma } from '@metorial-subspace/db';

export let managedProviderAuthCredentialsBackingSourceInclude = {
  provider: {
    include: {
      defaultVariant: true
    }
  },
  initialProviderAuthMethod: {
    include: {
      provider: {
        include: {
          defaultVariant: true
        }
      }
    }
  },
  backings: {
    include: {
      providerAuthCredentials: {
        select: {
          oid: true,
          id: true,
          status: true,
          scopes: true,
          updatedAt: true
        }
      }
    }
  }
};

export type ManagedProviderAuthCredentialsBackingSource =
  Prisma.ManagedProviderAuthCredentialsGetPayload<{
    include: typeof managedProviderAuthCredentialsBackingSourceInclude;
  }>;
