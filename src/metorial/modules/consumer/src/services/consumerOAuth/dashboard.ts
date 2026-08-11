import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type ConsumerProfile, type ConsumerSurface, type Instance } from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { skillPluginService, skillResourceService } from '@metorial/cargo-module-skill';
import { magicMcpEndpointService } from '@metorial/module-magic';
import { resolveResourceScopeForOwner } from '@metorial/module-resource-tenant';
import { addMinutes } from 'date-fns';
import { consumerIntegrationService } from '../consumerEntities/consumerIntegration';
import {
  ensurePendingConsumerAuthAuthorization,
  ensureSkillPluginMatchesEndpoint,
  getAttemptMagicMcpEndpoint,
  getConsumerAuthClientPlugin,
  getSkillPluginOwner
} from './_helpers';
import {
  consumerAuthAttemptInclude,
  consumerAuthClientInclude,
  ConsumerOAuthAuthorization
} from './_types';

class ConsumerOAuthDashboardService {
  async getConsumerAuthClientForConsumer(d: {
    instance: Instance;
    consumerSurface: ConsumerSurface;
    portalAuthClientId: string;
  }) {
    let portalOAuthClient = await db.consumerAuthClient.findFirst({
      where: {
        id: d.portalAuthClientId,
        instanceOid: d.instance.oid,
        consumerAuthClientSurfaces: {
          some: {
            consumerSurfaceOid: d.consumerSurface.oid
          }
        }
      },
      include: consumerAuthClientInclude
    });

    if (!portalOAuthClient) {
      throw new ServiceError(notFoundError('portal.oauth_client'));
    }

    return portalOAuthClient;
  }

  async getConsumerAuthAuthorizationForConsumer(d: {
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    portalAuthAttemptId: string;
  }) {
    let portalOAuthAuthorization = await db.consumerAuthAttempt.findFirst({
      where: {
        id: d.portalAuthAttemptId,
        consumerAuthClient: {
          instanceOid: d.instance.oid,
          consumerAuthClientSurfaces: {
            some: {
              consumerSurfaceOid: d.consumerSurface.oid
            }
          }
        }
      },
      include: consumerAuthAttemptInclude
    });

    if (!portalOAuthAuthorization) {
      throw new ServiceError(notFoundError('portal.oauth_authorization'));
    }

    if (
      portalOAuthAuthorization.consumerProfile &&
      portalOAuthAuthorization.consumerProfile.oid != d.consumerProfile.oid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This OAuth authorization belongs to a different consumer profile.'
        })
      );
    }

    return {
      ...portalOAuthAuthorization,
      skillPluginSupportedProviderIds: await this.getSkillPluginSupportedProviderIds({
        skillPlugin: portalOAuthAuthorization.skillPlugin
      })
    };
  }

  async acceptConsumerAuthAuthorization(d: {
    portalOAuthAuthorization: ConsumerOAuthAuthorization;
    consumerProfile: ConsumerProfile;
  }) {
    ensurePendingConsumerAuthAuthorization(d.portalOAuthAuthorization);

    if (
      !d.portalOAuthAuthorization.consumerAuthClient.magicMcpServerOid &&
      !d.portalOAuthAuthorization.consumerAuthClient.magicMcpEndpointOid &&
      !d.portalOAuthAuthorization.magicMcpEndpointOid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'Select at least one Magic MCP server before approving this OAuth authorization.'
        })
      );
    }

    let now = new Date();
    let portalOAuthAuthorization = await db.consumerAuthAttempt.update({
      where: {
        id: d.portalOAuthAuthorization.id
      },
      data: {
        status: 'authorized',
        consumerProfileOid: d.consumerProfile.oid,
        authorizedAt: now,
        deniedAt: null,
        authorizationCode: d.portalOAuthAuthorization.authorizationCode ?? crypto.randomUUID(),
        authorizationCodeExpiresAt: addMinutes(now, 10)
      },
      include: consumerAuthAttemptInclude
    });

    let magicMcpEndpoint = getAttemptMagicMcpEndpoint(portalOAuthAuthorization);
    if (magicMcpEndpoint) {
      ensureSkillPluginMatchesEndpoint({
        skillPlugin: getConsumerAuthClientPlugin(portalOAuthAuthorization.consumerAuthClient),
        magicMcpEndpoint
      });
      let isManaged = magicMcpEndpoint.consumerProfileOid !== d.consumerProfile.oid;

      await consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint({
        consumerAuthAttempt: portalOAuthAuthorization,
        consumerProfile: d.consumerProfile,
        magicMcpEndpoint,
        isManaged
      });
    }

    return portalOAuthAuthorization;
  }

  async connectConsumerAuthAuthorizationToMagicMcpEndpoint(d: {
    portalOAuthAuthorization: ConsumerOAuthAuthorization;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    consumerProfile: ConsumerProfile;
    magicMcpEndpointId: string;
  }) {
    ensurePendingConsumerAuthAuthorization(d.portalOAuthAuthorization);

    let magicMcpEndpoint = await magicMcpEndpointService.getMagicMcpEndpointById({
      magicMcpEndpointId: d.magicMcpEndpointId,
      instance: d.instance,
      accessTags: d.accessTags
    });

    if (magicMcpEndpoint.consumerProfileOid != d.consumerProfile.oid) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'You can only link this OAuth authorization to a magic MCP endpoint you own.'
        })
      );
    }

    if (magicMcpEndpoint.servers.length == 0) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'Add at least one Magic MCP server to the endpoint before linking it to this OAuth authorization.'
        })
      );
    }

    ensureSkillPluginMatchesEndpoint({
      skillPlugin: getConsumerAuthClientPlugin(d.portalOAuthAuthorization.consumerAuthClient),
      magicMcpEndpoint
    });

    let portalOAuthAuthorization = await db.consumerAuthAttempt.update({
      where: {
        id: d.portalOAuthAuthorization.id
      },
      data: {
        consumerProfileOid: d.consumerProfile.oid,
        magicMcpEndpointOid: magicMcpEndpoint.oid,
        skillPluginOid:
          d.portalOAuthAuthorization.consumerAuthClient.skillPluginOid ??
          magicMcpEndpoint.skillPluginOid
      },
      include: consumerAuthAttemptInclude
    });

    await consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint({
      consumerAuthAttempt: portalOAuthAuthorization,
      consumerProfile: d.consumerProfile,
      magicMcpEndpoint,
      isManaged: false
    });

    return portalOAuthAuthorization;
  }

  async rejectConsumerAuthAuthorization(d: {
    portalOAuthAuthorization: ConsumerOAuthAuthorization;
    consumerProfile: ConsumerProfile;
  }) {
    ensurePendingConsumerAuthAuthorization(d.portalOAuthAuthorization);

    return await db.consumerAuthAttempt.update({
      where: {
        id: d.portalOAuthAuthorization.id
      },
      data: {
        status: 'denied',
        consumerProfileOid:
          d.portalOAuthAuthorization.consumerProfileOid ?? d.consumerProfile.oid,
        deniedAt: new Date()
      },
      include: consumerAuthAttemptInclude
    });
  }

  private async getSkillPluginSupportedProviderIds(d: {
    skillPlugin: ConsumerOAuthAuthorization['skillPlugin'];
  }) {
    if (!d.skillPlugin) return [];

    let owner = getSkillPluginOwner(d.skillPlugin);
    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: owner.instance
    });
    let skillPlugin = await skillPluginService.getSkillPluginById({
      ...scope,
      skillPluginId: d.skillPlugin.id
    });
    let resources = await skillResourceService.hydrateDelegatedSkillResources({
      instance: owner.instance,
      skillIds: skillPlugin.skillPluginSkills
        .filter(skill => skill.status === 'active')
        .map(skill => skill.skill.id)
    });

    return Array.from(
      new Set(resources.flatMap(resource => resource.providers.map(provider => provider.id)))
    );
  }
}

export let consumerOAuthDashboardService = Service.create(
  'consumerOAuthDashboardService',
  () => new ConsumerOAuthDashboardService()
).build();
