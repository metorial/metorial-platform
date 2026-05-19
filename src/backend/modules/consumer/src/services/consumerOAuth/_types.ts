import {
  Organization,
  Portal,
  Prisma,
  Project,
  type ConsumerSurface,
  type Instance
} from '@metorial/db';

export let consumerAuthClientInclude = {
  consumerAuthClientConsumerSurfaces: {
    include: {
      consumerClient: true,
      consumerSurface: {
        include: {
          portal: true,
          organization: true,
          instance: {
            include: {
              project: true,
              organization: true
            }
          }
        }
      }
    }
  },
  skillPlugin: {
    include: {
      organization: true,
      instance: {
        include: {
          project: true,
          organization: true
        }
      }
    }
  },
  magicMcpServer: true,
  magicMcpEndpoint: true
} satisfies Prisma.ConsumerAuthClientInclude;

export let consumerAuthAttemptInclude = {
  consumerAuthClient: {
    include: consumerAuthClientInclude
  },
  consumerProfile: {
    include: {
      surface: {
        include: {
          instance: {
            include: {
              project: true,
              organization: true
            }
          },
          organization: true,
          portal: true
        }
      }
    }
  },
  magicMcpEndpoint: {
    include: {
      skillPlugin: true
    }
  },
  skillPlugin: {
    include: {
      organization: true,
      instance: {
        include: {
          project: true,
          organization: true
        }
      }
    }
  },
  magicMcpToken: true
} satisfies Prisma.ConsumerAuthAttemptInclude;

export type ConsumerOAuthClient = Prisma.ConsumerAuthClientGetPayload<{
  include: typeof consumerAuthClientInclude;
}>;

export type ConsumerOAuthAuthorization = Prisma.ConsumerAuthAttemptGetPayload<{
  include: typeof consumerAuthAttemptInclude;
}> & {
  skillPluginSupportedProviderIds?: string[];
};

export type DashboardConsumerSurface = ConsumerSurface & {
  instance: Instance & {
    project: Project;
    organization: Organization;
  };
};

export type ConsumerSurfaceWithContext = ConsumerSurface & {
  organization: Organization;
  instance: Instance & {
    project: Project;
    organization: Organization;
  };
  portal: Portal | null;
};

export type SkillPluginPortalAuthorizationInput = {
  responseType?: string;
  clientId?: string;
  redirectUri?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  state?: string;
};

export let consumerAuthRefreshTokenTtlSeconds = 30 * 24 * 60 * 60;
export let consumerAuthAccessTokenTtlSeconds = consumerAuthRefreshTokenTtlSeconds;
export let consumerAuthClientRegistrationsPerMinuteLimit = 10;
export let consumerAuthClientRegistrationsPerHourLimit = 20;
