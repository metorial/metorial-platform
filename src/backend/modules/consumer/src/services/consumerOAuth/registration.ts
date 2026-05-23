import { notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
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
import { addDays, addMinutes } from 'date-fns';
import {
  getPortalAllowedRedirectUrlFilters,
  validatePortalRedirectUrisAgainstAllowedFilters,
  validateUrlString
} from '../../lib/oauth';
import { portalService } from '../portal';
import {
  consumerAuthClientRegistrationRateLimitError,
  normalizeConsumerClientRedirectUris,
  resolveConsumerSurface
} from './_helpers';
import {
  consumerAuthClientInclude,
  consumerAuthClientRegistrationsPerHourLimit,
  consumerAuthClientRegistrationsPerMinuteLimit
} from './_types';
import { consumerOAuthClientService } from './client';

class ConsumerOAuthRegistrationService {
  async registerConsumerAuthClient(d: {
    portal?: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    consumerSurface?: ConsumerSurface;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    input: {
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

    return await withTransaction(async db => {
      await this.ensureRegistrationRateLimit({ registrationIp: d.input.registrationIp });

      let consumerClient = await consumerOAuthClientService.upsertConsumerClient({
        consumerSurface,
        name: d.input.clientName,
        redirectUris
      });

      let registration = await db.consumerAuthClient.create({
        data: {
          id: await ID.generateId('consumerAuthClient'),
          instanceOid: consumerSurface.instanceOid,
          organizationOid: consumerSurface.organizationOid,
          magicMcpServerOid:
            d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : null,
          magicMcpEndpointOid:
            d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : null,
          name: d.input.clientName,
          redirectUris,
          registrationIp: d.input.registrationIp,
          clientId: await ID.generateId('consumerAuthClientId'),
          clientSecret,
          tokenEndpointAuthMethod,
          expiresAt: addDays(new Date(), 30)
        }
      });

      await consumerOAuthClientService.ensureConsumerAuthClientSurfaceRef({
        consumerAuthClient: registration,
        consumerSurface,
        consumerClient
      });

      return await db.consumerAuthClient.findFirstOrThrow({
        where: {
          id: registration.id
        },
        include: consumerAuthClientInclude
      });
    });
  }

  async registerSkillPluginConsumerAuthClient(d: {
    skillPlugin: SkillPlugin & { organization: Organization; instance: Instance };
    input: {
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

    return await withTransaction(async db => {
      await this.ensureRegistrationRateLimit({ registrationIp: d.input.registrationIp });

      return await db.consumerAuthClient.create({
        data: {
          id: await ID.generateId('consumerAuthClient'),
          instanceOid: d.skillPlugin.instanceOid,
          organizationOid: d.skillPlugin.organizationOid,
          skillPluginOid: d.skillPlugin.oid,
          name: d.input.clientName,
          redirectUris,
          registrationIp: d.input.registrationIp,
          clientId: await ID.generateId('consumerAuthClientId'),
          clientSecret,
          tokenEndpointAuthMethod,
          expiresAt: addDays(new Date(), 30)
        },
        include: consumerAuthClientInclude
      });
    });
  }

  async getConsumerAuthRegistration(d: {
    portal?: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
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

  private async ensureRegistrationRateLimit(d: { registrationIp: string }) {
    let now = new Date();
    let registrationsPerMinute = await db.consumerAuthClient.count({
      where: {
        registrationIp: d.registrationIp,
        createdAt: {
          gte: addMinutes(now, -1)
        }
      }
    });
    if (registrationsPerMinute >= consumerAuthClientRegistrationsPerMinuteLimit) {
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
    if (registrationsPerHour >= consumerAuthClientRegistrationsPerHourLimit) {
      throw new ServiceError(consumerAuthClientRegistrationRateLimitError);
    }
  }
}

export let consumerOAuthRegistrationService = Service.create(
  'consumerOAuthRegistrationService',
  () => new ConsumerOAuthRegistrationService()
).build();
