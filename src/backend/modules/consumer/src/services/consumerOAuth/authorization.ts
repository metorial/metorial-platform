import {
  badRequestError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { generateCustomId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  Organization,
  Project,
  SkillPlugin,
  type ConsumerSurface,
  type Instance
} from '@metorial/db';
import { type MagicMcpResolvedTarget } from '@metorial/module-magic';
import { addDays } from 'date-fns';
import { buildDashboardConsumerAuthUrl, resolveConsumerSurface } from './_helpers';
import {
  consumerAuthAttemptInclude,
  consumerAuthClientInclude,
  DashboardConsumerSurface,
  SkillPluginPortalAuthorizationInput
} from './_types';
import {
  getPortalAllowedRedirectUrlFilters,
  validatePortalRedirectUriAgainstAllowedFilters,
  validateRedirectUri
} from '../../lib/oauth';
import { portalService } from '../portal';
import { consumerOAuthClientService } from './client';

class ConsumerOAuthAuthorizationService {
  async createConsumerAuthAuthorization(d: {
    portal?: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    consumerSurface?: DashboardConsumerSurface;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    input: {
      responseType?: string;
      clientId?: string;
      redirectUri?: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
      state?: string;
    };
  }) {
    this.validateAuthorizationRequest(d.input);

    let consumerSurface = resolveConsumerSurface(d);
    if (!consumerSurface) {
      throw new ServiceError(notFoundError('consumer.surface'));
    }

    let client = await this.getConsumerAuthClient({
      clientId: d.input.clientId!,
      consumerSurfaceOid: consumerSurface.oid,
      skillPluginOid: undefined,
      magicMcpServerOid:
        d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : undefined,
      magicMcpEndpointOid:
        d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : undefined
    });
    validateRedirectUri(d.input.redirectUri!, client.redirectUris);
    if (d.portal) {
      validatePortalRedirectUriAgainstAllowedFilters({
        redirectUri: d.input.redirectUri!,
        allowedRedirectUrlFilters: getPortalAllowedRedirectUrlFilters(
          d.portal.allowedRedirectUrlFilters
        )
      });
    }

    let normalizedCodeChallengeMethod = this.getNormalizedCodeChallengeMethod(d.input);
    let attempt = await db.consumerAuthAttempt.create({
      data: {
        id: await ID.generateId('consumerAuthAttempt'),
        consumerAuthClientOid: client.oid,
        skillPluginOid: client.skillPluginOid,
        status: 'pending',
        redirectUri: d.input.redirectUri!,
        state: d.input.state,
        authorizationCode: generateCustomId('prtl_oatc_', 35),
        codeChallengeMethod: normalizedCodeChallengeMethod,
        codeChallenge: d.input.codeChallenge,
        expiresAt: addDays(new Date(), 7)
      },
      include: consumerAuthAttemptInclude
    });

    let redirectUrl = d.portal
      ? (() => {
          let url = new URL(portalService.getPortalHost({ portal: d.portal! }).host);
          let basePath = url.pathname.replace(/\/+$/, '');
          url.pathname = `${basePath}/oauth/authorize/${attempt.id}`.replace(/\/{2,}/g, '/');
          url.search = '';
          url.hash = '';

          return url.toString();
        })()
      : buildDashboardConsumerAuthUrl({
          consumerSurface: d.consumerSurface!,
          consumerAuthAttemptId: attempt.id
        });

    return {
      attempt,
      redirectUrl
    };
  }

  async createSkillPluginConsumerAuthAuthorization(d: {
    skillPlugin: SkillPlugin & {
      instance: Instance & { project: Project; organization: Organization };
    };
    portalId?: string;
    input: SkillPluginPortalAuthorizationInput;
  }): Promise<
    | { type: 'redirect'; redirectUrl: string }
    | { type: 'workforce_required' }
    | {
        type: 'portal_selection';
        skillPlugin: Pick<SkillPlugin, 'id' | 'name'>;
        portals: { id: string; slug: string; name: string }[];
      }
  > {
    if (!d.input.clientId) {
      throw new ServiceError(
        badRequestError({
          message: 'client_id is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'client_id is required'
          }
        })
      );
    }

    let registration = await db.consumerAuthClient.findFirst({
      where: {
        clientId: d.input.clientId,
        skillPluginOid: d.skillPlugin.oid,
        instanceOid: d.skillPlugin.instanceOid,
        organizationOid: d.skillPlugin.organizationOid,
        magicMcpServerOid: null,
        magicMcpEndpointOid: null
      },
      include: consumerAuthClientInclude
    });
    if (!registration || registration.expiresAt < new Date()) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid oauth client',
          oauth: {
            error: 'invalid_client',
            errorMessage: 'Invalid oauth client'
          }
        })
      );
    }

    let portals = await db.portal.findMany({
      where: {
        instanceOid: d.skillPlugin.instanceOid,
        status: 'active'
      },
      include: {
        surface: {
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
        },
        organization: true,
        instance: {
          include: {
            project: true,
            organization: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (portals.length == 0) {
      return {
        type: 'workforce_required'
      };
    }

    let portal =
      d.portalId == null
        ? portals.length == 1
          ? portals[0]
          : null
        : portals.find(portal => portal.id == d.portalId || portal.slug == d.portalId);

    if (!portal) {
      if (d.portalId) {
        throw new ServiceError(notFoundError('portal', d.portalId));
      }

      return {
        type: 'portal_selection',
        skillPlugin: d.skillPlugin,
        portals: portals.map(portal => ({
          id: portal.id,
          slug: portal.slug,
          name: portal.name
        }))
      };
    }

    await consumerOAuthClientService.ensureConsumerAuthClientSurface({
      consumerAuthClient: registration,
      consumerSurface: portal.surface
    });

    let publicPortal = await portalService.getPortalPublic({ portalId: portal.id });
    let authorization = await this.createConsumerAuthAuthorization({
      portal: publicPortal,
      magicMcpTarget: null,
      input: d.input
    });

    return {
      type: 'redirect',
      redirectUrl: authorization.redirectUrl
    };
  }

  private validateAuthorizationRequest(input: {
    responseType?: string;
    clientId?: string;
    redirectUri?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }) {
    if (!input.responseType) {
      throw new ServiceError(
        badRequestError({
          message: 'response_type is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'response_type is required'
          }
        })
      );
    }

    if (input.responseType != 'code') {
      throw new ServiceError(
        badRequestError({
          message: 'Only response_type=code is supported',
          oauth: {
            error: 'unsupported_response_type',
            errorMessage: 'Only response_type=code is supported'
          }
        })
      );
    }

    if (!input.clientId) {
      throw new ServiceError(
        badRequestError({
          message: 'client_id is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'client_id is required'
          }
        })
      );
    }

    if (!input.redirectUri) {
      throw new ServiceError(
        badRequestError({
          message: 'redirect_uri is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'redirect_uri is required'
          }
        })
      );
    }

    if (
      input.codeChallengeMethod &&
      !['S256', 's256', 'none'].includes(input.codeChallengeMethod)
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Only S256 PKCE challenges are supported',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'Only S256 PKCE challenges are supported'
          }
        })
      );
    }

    let normalizedCodeChallengeMethod = this.getNormalizedCodeChallengeMethod(input);

    if (normalizedCodeChallengeMethod == 's256' && !input.codeChallenge) {
      throw new ServiceError(
        badRequestError({
          message: 'code_challenge is required when using PKCE',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'code_challenge is required when using PKCE'
          }
        })
      );
    }
  }

  private getNormalizedCodeChallengeMethod(input: {
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }) {
    return input.codeChallengeMethod == 'S256' || input.codeChallengeMethod == 's256'
      ? ('s256' as const)
      : input.codeChallenge
        ? ('s256' as const)
        : ('none' as const);
  }

  private async getConsumerAuthClient(d: {
    clientId: string;
    consumerSurfaceOid: bigint;
    skillPluginOid?: bigint;
    magicMcpServerOid?: bigint;
    magicMcpEndpointOid?: bigint;
  }) {
    let client = await db.consumerAuthClient.findFirst({
      where: {
        clientId: d.clientId,
        consumerAuthClientConsumerSurfaces: {
          some: {
            consumerSurfaceOid: d.consumerSurfaceOid
          }
        },
        skillPluginOid: d.skillPluginOid,
        magicMcpServerOid: d.magicMcpServerOid ?? null,
        magicMcpEndpointOid: d.magicMcpEndpointOid ?? null
      },
      include: consumerAuthClientInclude
    });

    if (!client || client.expiresAt < new Date()) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid oauth client',
          oauth: {
            error: 'invalid_client',
            errorMessage: 'Invalid oauth client'
          }
        })
      );
    }

    return client;
  }
}

export let consumerOAuthAuthorizationService = Service.create(
  'consumerOAuthAuthorizationService',
  () => new ConsumerOAuthAuthorizationService()
).build();
