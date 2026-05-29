import type { Prisma } from '@metorial/db';

export let portalWithSurfaceInclude = {
  surface: {
    include: {
      consumerAuthTenant: true,
      publishableApiKey: {
        include: {
          secrets: true
        }
      }
    }
  },
  organization: true,
  instance: {
    include: {
      project: true,
      organization: true
    }
  }
} as const;

export type PortalWithSurface = Prisma.PortalGetPayload<{
  include: typeof portalWithSurfaceInclude;
}>;

export type PortalTokenSession = {
  id: string;
  expiresAt: Date;
};
