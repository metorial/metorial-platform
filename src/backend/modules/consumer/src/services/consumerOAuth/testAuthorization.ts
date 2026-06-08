import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { ConsumerAuthAttemptCodeChallengeMethod, db, ID, Instance } from '@metorial/db';
import { addMinutes } from 'date-fns';
import {
  buildConsumerOAuthCallbackRedirectUrl,
  getConsumerAuthClientSurface
} from './_helpers';
import { consumerAuthClientInclude, ConsumerOAuthAuthorization } from './_types';
import { consumerOAuthDashboardService } from './dashboard';

let testAuthorizationTtlMinutes = 10;

let getRequiredSearchParam = (url: URL, name: string) => {
  let value = url.searchParams.get(name);
  if (!value) {
    throw new ServiceError(
      badRequestError({
        message: `${name} is required in the authorization URL.`
      })
    );
  }

  return value;
};

let normalizeCodeChallengeMethod = (value: string | null) => {
  if (!value || value == 'none') return 'none' as const;
  if (value == 'S256' || value == 's256') return 's256' as const;

  throw new ServiceError(
    badRequestError({
      message: 'Only S256 PKCE challenges are supported.'
    })
  );
};

let parseConnectPath = (url: URL) => {
  let parts = url.pathname.split('/').filter(Boolean);
  let connectIdx = parts.indexOf('connect');
  if (connectIdx < 0) {
    throw new ServiceError(
      badRequestError({
        message: 'The authorization URL must be a Metorial connect URL.'
      })
    );
  }

  let type = parts[connectIdx + 1];
  let targetId = parts[connectIdx + 2];
  let oauthIdx = parts.indexOf('oauth');
  let action = oauthIdx >= 0 ? parts[oauthIdx + 1] : undefined;

  if (!targetId || action != 'authorize') {
    throw new ServiceError(
      badRequestError({
        message: 'The authorization URL must point to an OAuth authorize endpoint.'
      })
    );
  }

  if (type == 'portal') {
    return {
      type: 'portal' as const,
      portalId: targetId
    };
  }

  if (type == 'plugin') {
    return {
      type: 'plugin' as const,
      pluginId: targetId
    };
  }

  throw new ServiceError(
    badRequestError({
      message: 'Only portal and plugin connect authorization URLs are supported.'
    })
  );
};

class ConsumerOAuthTestAuthorizationService {
  async createTestAuthorization(d: {
    instance: Instance;
    input: {
      url: string;
      consumerProfileId: string;
      magicMcpEndpointId: string;
    };
  }) {
    let url = new URL(d.input.url);
    let route = parseConnectPath(url);
    let clientId = getRequiredSearchParam(url, 'client_id');
    let redirectUri = getRequiredSearchParam(url, 'redirect_uri');
    let state = url.searchParams.get('state');
    let codeChallenge = url.searchParams.get('code_challenge');
    let codeChallengeMethod = normalizeCodeChallengeMethod(
      url.searchParams.get('code_challenge_method')
    );

    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        id: d.input.consumerProfileId,
        instanceOid: d.instance.oid
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
        }
      }
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    let magicMcpEndpoint = await db.magicMcpEndpoint.findFirst({
      where: {
        id: d.input.magicMcpEndpointId,
        instanceOid: d.instance.oid
      },
      include: {
        servers: true,
        skillPlugin: true
      }
    });
    if (!magicMcpEndpoint) {
      throw new ServiceError(notFoundError('magic_mcp.endpoint'));
    }

    if (magicMcpEndpoint.consumerProfileOid != consumerProfile.oid) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The Magic MCP endpoint must belong to the provided consumer profile.'
        })
      );
    }

    if (magicMcpEndpoint.servers.length == 0) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'Add at least one Magic MCP server to the endpoint before creating a test authorization.'
        })
      );
    }

    let client = await db.consumerAuthClient.findFirst({
      where: {
        clientId,
        instanceOid: d.instance.oid,
        skillPlugin:
          route.type == 'plugin'
            ? { OR: [{ id: route.pluginId }, { slug: route.pluginId }] }
            : undefined
      },
      include: consumerAuthClientInclude
    });
    if (!client || client.expiresAt < new Date()) {
      throw new ServiceError(notFoundError('consumer.oauth_client'));
    }

    let consumerSurface =
      route.type == 'plugin'
        ? consumerProfile.surface
        : client.consumerAuthClientSurfaces.find(ref => {
            let surface = ref.consumerSurface;
            return (
              surface.id == route.portalId ||
              surface.portal?.id == route.portalId ||
              surface.portal?.slug == route.portalId
            );
          })?.consumerSurface;

    if (!consumerSurface) {
      consumerSurface =
        route.type == 'plugin'
          ? consumerProfile.surface
          : getConsumerAuthClientSurface(client);
    }

    if (!consumerSurface) {
      throw new ServiceError(notFoundError('consumer.surface'));
    }

    if (consumerSurface.oid != consumerProfile.surfaceOid) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The consumer profile is not part of the authorization surface.'
        })
      );
    }

    if (route.type == 'plugin') {
      if (!consumerProfile.surface.portal) {
        throw new ServiceError(
          preconditionFailedError({
            message: 'Plugin test authorization requires a Workforce portal surface.'
          })
        );
      }

      if (!url.searchParams.get('portal_id')) {
        url.searchParams.set('portal_id', consumerProfile.surface.portal.id);
      }
    }

    let testAuthorization = await db.consumerAuthTestAuthorization.create({
      data: {
        id: await ID.generateId('consumerAuthTestAuthorization'),
        clientId,
        consumerAuthClientOid: client.oid,
        consumerSurfaceOid: consumerSurface.oid,
        instanceOid: d.instance.oid,
        organizationOid: d.instance.organizationOid,
        consumerProfileOid: consumerProfile.oid,
        magicMcpEndpointOid: magicMcpEndpoint.oid,
        skillPluginOid: client.skillPluginOid ?? magicMcpEndpoint.skillPluginOid,
        redirectUri,
        state,
        codeChallengeMethod,
        codeChallenge,
        expiresAt: addMinutes(new Date(), testAuthorizationTtlMinutes)
      }
    });

    url.searchParams.set('test_auth_id', testAuthorization.id);

    return {
      testAuthorization,
      url: url.toString()
    };
  }

  async consumeTestAuthorization(d: {
    testAuthorizationId: string;
    instance: Instance;
    portalOAuthAuthorization: ConsumerOAuthAuthorization;
    input: {
      clientId?: string;
      redirectUri?: string;
      state?: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
    };
  }) {
    let testAuthorization = await db.consumerAuthTestAuthorization.findFirst({
      where: {
        id: d.testAuthorizationId,
        instanceOid: d.instance.oid
      },
      include: {
        consumerProfile: true,
        magicMcpEndpoint: true,
        consumerAuthClient: true
      }
    });

    if (!testAuthorization) {
      throw new ServiceError(notFoundError('consumer.oauth_test_authorization'));
    }

    if (testAuthorization.consumedAt) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This test authorization has already been used.'
        })
      );
    }

    if (testAuthorization.expiresAt < new Date()) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This test authorization has expired.'
        })
      );
    }

    this.ensureRequestMatchesTestAuthorization({
      testAuthorization,
      input: d.input
    });

    if (
      d.portalOAuthAuthorization.consumerAuthClientOid !=
      testAuthorization.consumerAuthClientOid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This test authorization belongs to a different OAuth client.'
        })
      );
    }

    let connected =
      await consumerOAuthDashboardService.connectConsumerAuthAuthorizationToMagicMcpEndpoint({
        portalOAuthAuthorization: d.portalOAuthAuthorization,
        instance: d.instance,
        consumerProfile: testAuthorization.consumerProfile,
        magicMcpEndpointId: testAuthorization.magicMcpEndpoint.id
      });

    let accepted = await consumerOAuthDashboardService.acceptConsumerAuthAuthorization({
      portalOAuthAuthorization: connected,
      consumerProfile: testAuthorization.consumerProfile
    });

    await db.consumerAuthTestAuthorization.update({
      where: {
        id: testAuthorization.id
      },
      data: {
        consumedAt: new Date(),
        consumerAuthAttemptOid: accepted.oid
      }
    });

    let redirectUrl = buildConsumerOAuthCallbackRedirectUrl({
      redirectUri: accepted.redirectUri,
      state: accepted.state,
      status: accepted.status,
      authorizationCode: accepted.authorizationCode
    });

    if (!redirectUrl) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The test authorization did not produce a redirect URL.'
        })
      );
    }

    return {
      portalOAuthAuthorization: accepted,
      redirectUrl
    };
  }

  private ensureRequestMatchesTestAuthorization(d: {
    testAuthorization: {
      clientId: string;
      redirectUri: string;
      state: string | null;
      codeChallenge: string | null;
      codeChallengeMethod: ConsumerAuthAttemptCodeChallengeMethod;
    };
    input: {
      clientId?: string;
      redirectUri?: string;
      state?: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
    };
  }) {
    let codeChallengeMethod = normalizeCodeChallengeMethod(
      d.input.codeChallengeMethod ?? null
    );

    let expected = d.testAuthorization;
    let mismatches = [
      expected.clientId != d.input.clientId ? 'client_id' : null,
      expected.redirectUri != d.input.redirectUri ? 'redirect_uri' : null,
      (expected.state ?? undefined) != d.input.state ? 'state' : null,
      (expected.codeChallenge ?? undefined) != d.input.codeChallenge ? 'code_challenge' : null,
      expected.codeChallengeMethod != codeChallengeMethod ? 'code_challenge_method' : null
    ].filter((value): value is string => !!value);

    if (mismatches.length) {
      throw new ServiceError(
        preconditionFailedError({
          message: `The authorization request does not match this test authorization: ${mismatches.join(', ')}.`
        })
      );
    }
  }
}

export let consumerOAuthTestAuthorizationService = Service.create(
  'consumerOAuthTestAuthorizationService',
  () => new ConsumerOAuthTestAuthorizationService()
).build();
