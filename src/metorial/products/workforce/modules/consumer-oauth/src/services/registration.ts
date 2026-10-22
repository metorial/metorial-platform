import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  getPortalAllowedRedirectUrlFilters,
  validatePortalRedirectUrisAgainstAllowedFilters,
  validateUrlString
} from '@metorial/consumer-oauth-utils';
import {
  db,
  ID,
  Organization,
  SkillPlugin,
  withTransaction,
  type ConsumerSurface,
  type Instance
} from '@metorial/db';
import { type MagicMcpResolvedTarget } from '@metorial/module-magic';
import { portalService } from '@metorial/module-portal';
import { addMinutes } from 'date-fns';
import {
  consumerAuthClientRegistrationRateLimitError,
  getConsumerAuthClientExpiry,
  normalizeConsumerClientMetadata,
  normalizeConsumerClientRedirectUris,
  resolveConsumerSurface
} from './_helpers';
import {
  consumerAuthClientInclude,
  consumerAuthClientRegistrationsPerHourLimit,
  consumerAuthClientRegistrationsPerMinuteLimit,
  type ConsumerClientMetadataInput
} from './_types';
import { consumerOAuthClientService } from './client';

type FullPortal = Awaited<ReturnType<typeof portalService.getPortalPublic>>;

class ConsumerOAuthRegistrationService {
  async registerConsumerAuthClient(d: {
    portal?: FullPortal;
    consumerSurface?: ConsumerSurface;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    input: ConsumerClientMetadataInput & {
      clientName: string;
      redirectUris: string[];
      registrationIp: string;
      tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none';
    };
  }) {
    let consumerSurface = resolveConsumerSurface(d);
    if (!consumerSurface) {
      throw new ServiceError(notFoundError('consumer.surface'));
    }

    for (let redirectUri of d.input.redirectUris) {
      validateUrlString(redirectUri, 'redirect_uri');
    }
    if (d.portal) {
      validatePortalRedirectUrisAgainstAllowedFilters({
        redirectUris: d.input.redirectUris,
        allowedRedirectUrlFilters: getPortalAllowedRedirectUrlFilters(
          d.portal.allowedRedirectUrlFilters
        )
      });
    }

    let tokenEndpointAuthMethod = d.input.tokenEndpointAuthMethod ?? 'client_secret_basic';
    let clientSecret =
      tokenEndpointAuthMethod == 'none'
        ? null
        : await ID.generateId('consumerAuthClientSecret');
    let redirectUris = normalizeConsumerClientRedirectUris(d.input.redirectUris);
    let metadata = normalizeConsumerClientMetadata(d.input);

    let { registration, consumerClient } = await withTransaction(async db => {
      await this.ensureRegistrationRateLimit({
        registrationIp: d.input.registrationIp,
        instanceOid: consumerSurface.instanceOid
      });

      let consumerClient = await consumerOAuthClientService.upsertConsumerClient({
        consumerSurface,
        name: d.input.clientName,
        redirectUris,
        metadata
      });

      let createdRegistration = await db.consumerAuthClient.create({
        data: {
          id: await ID.generateId('consumerAuthClient'),
          instanceOid: consumerSurface.instanceOid,
          organizationOid: consumerSurface.organizationOid,
          magicMcpServerOid:
            d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : null,
          magicMcpEndpointOid:
            d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : null,
          name: d.input.clientName,
          ...metadata,
          redirectUris,
          registrationIp: d.input.registrationIp,
          clientId: await ID.generateId('consumerAuthClientId'),
          clientSecret,
          tokenEndpointAuthMethod,
          expiresAt: getConsumerAuthClientExpiry()
        }
      });

      await consumerOAuthClientService.ensureConsumerAuthClientSurfaceRef({
        consumerAuthClient: createdRegistration,
        consumerSurface,
        consumerClient
      });

      let registration = await db.consumerAuthClient.findFirstOrThrow({
        where: {
          id: createdRegistration.id
        },
        include: consumerAuthClientInclude
      });

      return { registration, consumerClient };
    });

    await consumerOAuthClientService.requestConsumerClientLogoDiscovery({ consumerClient });

    return registration;
  }

  async registerSkillPluginConsumerAuthClient(d: {
    skillPlugin: SkillPlugin & { organization: Organization; instance: Instance };
    input: ConsumerClientMetadataInput & {
      clientName: string;
      redirectUris: string[];
      registrationIp: string;
      tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none';
    };
  }) {
    for (let redirectUri of d.input.redirectUris) {
      validateUrlString(redirectUri, 'redirect_uri');
    }

    let tokenEndpointAuthMethod = d.input.tokenEndpointAuthMethod ?? 'client_secret_basic';
    let clientSecret =
      tokenEndpointAuthMethod == 'none'
        ? null
        : await ID.generateId('consumerAuthClientSecret');
    let redirectUris = normalizeConsumerClientRedirectUris(d.input.redirectUris);
    let metadata = normalizeConsumerClientMetadata(d.input);

    return await withTransaction(async db => {
      await this.ensureRegistrationRateLimit({
        registrationIp: d.input.registrationIp,
        instanceOid: d.skillPlugin.instanceOid
      });

      return await db.consumerAuthClient.create({
        data: {
          id: await ID.generateId('consumerAuthClient'),
          instanceOid: d.skillPlugin.instanceOid,
          organizationOid: d.skillPlugin.organizationOid,
          skillPluginOid: d.skillPlugin.oid,
          name: d.input.clientName,
          ...metadata,
          redirectUris,
          registrationIp: d.input.registrationIp,
          clientId: await ID.generateId('consumerAuthClientId'),
          clientSecret,
          tokenEndpointAuthMethod,
          expiresAt: getConsumerAuthClientExpiry()
        },
        include: consumerAuthClientInclude
      });
    });
  }

  async getConsumerAuthRegistration(d: {
    portal?: FullPortal;
    consumerSurface?: ConsumerSurface;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    registrationId: string;
  }) {
    let consumerSurface = resolveConsumerSurface(d);
    if (!consumerSurface) {
      throw new ServiceError(notFoundError('consumer.surface'));
    }

    return await db.consumerAuthClient.findFirst({
      where: {
        id: d.registrationId,
        consumerAuthClientSurfaces: {
          some: {
            consumerSurfaceOid: consumerSurface.oid
          }
        },
        magicMcpServerOid:
          d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : null,
        magicMcpEndpointOid:
          d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : null
      },
      include: consumerAuthClientInclude
    });
  }

  async getSkillPluginConsumerAuthRegistration(d: {
    skillPlugin: SkillPlugin;
    registrationId: string;
  }) {
    return await db.consumerAuthClient.findFirst({
      where: {
        id: d.registrationId,
        skillPluginOid: d.skillPlugin.oid,
        instanceOid: d.skillPlugin.instanceOid,
        organizationOid: d.skillPlugin.organizationOid,
        magicMcpServerOid: null,
        magicMcpEndpointOid: null
      },
      include: consumerAuthClientInclude
    });
  }

  private async ensureRegistrationRateLimit(d: {
    registrationIp: string;
    instanceOid: bigint;
  }) {
    let project = await db.project.findFirstOrThrow({
      where: {
        instances: {
          some: {
            oid: d.instanceOid
          }
        }
      }
    });

    let now = new Date();
    let registrationsPerMinute = await db.consumerAuthClient.count({
      where: {
        registrationIp: d.registrationIp,
        createdAt: {
          gte: addMinutes(now, -1)
        }
      }
    });
    if (
      registrationsPerMinute >= consumerAuthClientRegistrationsPerMinuteLimit ||
      registrationsPerMinute >= project.consumerAuthClientRegistrationsPerMinuteLimit
    ) {
      throw new ServiceError(consumerAuthClientRegistrationRateLimitError);
    }

    let registrationsPerHour = await db.consumerAuthClient.count({
      where: {
        registrationIp: d.registrationIp,
        createdAt: {
          gte: addMinutes(now, -60)
        }
      }
    });
    if (
      registrationsPerHour >= consumerAuthClientRegistrationsPerHourLimit ||
      registrationsPerHour >= project.consumerAuthClientRegistrationsPerHourLimit
    ) {
      throw new ServiceError(consumerAuthClientRegistrationRateLimitError);
    }
  }
}

export let consumerOAuthRegistrationService = Service.create(
  'consumerOAuthRegistrationService',
  () => new ConsumerOAuthRegistrationService()
).build();
