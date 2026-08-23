import {
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  integrationService,
  integrationSetupSessionService
} from '@metorial-subspace/module-integration';
import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  ConsumerProviderSetupSessionType,
  ConsumerSurface,
  db,
  ID,
  Portal,
  ProviderTemplate,
  type Instance
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { providerTemplateService } from '@metorial/module-magic';
import { getPortalUrlForOrigin } from '@metorial/portal-url';

let buildProviderSetupRedirectUrl = async (d: {
  portal: Pick<Portal, 'oid' | 'slug'>;
  requestOrigin?: string | null;
}) => {
  let url = new URL(
    await getPortalUrlForOrigin({
      portal: d.portal,
      origin: d.requestOrigin
    })
  );
  let basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${basePath}/provider-setup-complete`.replace(/\/{2,}/g, '/');
  url.search = '';
  url.hash = '';

  return url.toString();
};

let getSetupSessionBindingMetadata = (d: {
  consumerProfile: Pick<ConsumerProfile, 'oid'>;
  providerTemplate: Pick<ProviderTemplate, 'oid' | 'id'>;
}) => ({
  $owner: 'consumer' as const,
  consumerProfileOid: d.consumerProfile.oid.toString(),
  providerTemplateOid: d.providerTemplate.oid.toString(),
  providerTemplateId: d.providerTemplate.id
});

let getConsumerIdentityContext = async (d: {
  instance: Instance;
  consumerProfile: Pick<ConsumerProfile, 'oid' | 'consumerOid'>;
}) => {
  let instanceConsumer = await db.instanceConsumer.findFirst({
    where: {
      instanceOid: d.instance.oid,
      consumerOid: d.consumerProfile.consumerOid
    }
  });

  if (!instanceConsumer) {
    return {
      identityActorId: null,
      identityId: null
    };
  }

  let consumerActor = await db.consumerActor.findFirst({
    where: {
      instanceOid: d.instance.oid,
      instanceConsumerOid: instanceConsumer.oid,
      consumerProfileOid: d.consumerProfile.oid,
      isDefault: true
    },
    select: {
      id: true,
      defaultIdentityId: true
    }
  });

  return {
    identityActorId: consumerActor?.id ?? null,
    identityId: consumerActor?.defaultIdentityId ?? null
  };
};

let assertSetupSessionBindingMatchesConsumerProvider = (d: {
  binding: {
    consumerProfileOid: bigint;
    providerTemplateOid: bigint;
    type: ConsumerProviderSetupSessionType;
  } | null;
  consumerProfile: Pick<ConsumerProfile, 'oid'>;
  providerTemplate: Pick<ProviderTemplate, 'oid'>;
}) => {
  if (!d.binding || d.binding.consumerProfileOid !== d.consumerProfile.oid) {
    throw new ServiceError(
      unauthorizedError({
        message: 'The selected setup session does not belong to this consumer.'
      })
    );
  }

  if (d.binding.providerTemplateOid !== d.providerTemplate.oid) {
    throw new ServiceError(
      unauthorizedError({
        message: 'The selected setup session does not belong to this template.'
      })
    );
  }
};

class ConsumerProviderSetupSessionServiceImpl {
  async startSetupSession(d: {
    instance: Instance;
    context: Context;
    accessTags: AnyAccessTagSelector;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    providerTemplateId: string;
    requestOrigin?: string | null;
    input: {
      providerAuthMethodId?: string;
    };
  }) {
    let providerTemplate = await providerTemplateService.getProviderTemplateById({
      instance: d.instance,
      providerTemplateId: d.providerTemplateId,
      accessTags: d.accessTags
    });

    let portal = await db.portal.findFirst({
      where: {
        instanceOid: d.instance.oid,
        surfaceOid: d.consumerSurface.oid
      },
      select: {
        oid: true,
        slug: true
      }
    });

    if (!portal) {
      throw new ServiceError(notFoundError('portal'));
    }

    if (!providerTemplate.subspaceIntegrationId) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This provider template does not have integration backing yet.'
        })
      );
    }

    let consumerIdentity = await getConsumerIdentityContext({
      instance: d.instance,
      consumerProfile: d.consumerProfile
    });

    await Fabric.fire('consumer.integration_setup_session.created:before', {
      instance: d.instance
    });

    let integration = await integrationService.getIntegrationById({
      instance: d.instance,
      integrationId: providerTemplate.subspaceIntegrationId
    });
    let setupSession = await integrationSetupSessionService.createIntegrationSetupSession({
      instance: d.instance,
      integration,
      input: {
        name: providerTemplate.name,
        description: providerTemplate.description ?? undefined,
        metadata: (providerTemplate.metadata as Record<string, unknown> | null) ?? {},
        privateMetadata: getSetupSessionBindingMetadata({
          consumerProfile: d.consumerProfile,
          providerTemplate
        }),
        identityActorId: consumerIdentity.identityActorId,
        identityId: consumerIdentity.identityId,
        redirectUrl: await buildProviderSetupRedirectUrl({
          portal,
          requestOrigin: d.requestOrigin
        }),
        configuration: {
          ui: {
            layout: 'light'
          }
        }
      },
      import: {
        ip: d.context.ip,
        ua: d.context.ua ?? ''
      }
    });

    await db.consumerProviderSetupSessionBinding.create({
      data: {
        id: await ID.generateId('consumerProviderSetupSessionBinding'),
        providerSetupSessionId: setupSession.id,
        type: 'integration_setup_session',
        consumerProfileOid: d.consumerProfile.oid,
        providerTemplateOid: providerTemplate.oid,
        instanceOid: d.instance.oid
      }
    });

    await Fabric.fire('consumer.integration_setup_session.created:after', {
      instance: d.instance,
      setupSession
    });

    return setupSession;
  }

  async getSetupSession(d: {
    instance: Instance;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    providerTemplate: Pick<ProviderTemplate, 'oid'>;
    integrationSetupSessionId: string;
  }) {
    return await this.getBoundSetupSession({
      instance: d.instance,
      integrationSetupSessionId: d.integrationSetupSessionId,
      consumerProfile: d.consumerProfile,
      providerTemplate: d.providerTemplate
    });
  }

  async getCompletedSetupSession(d: {
    instance: Instance;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    providerTemplate: Pick<ProviderTemplate, 'oid'>;
    integrationSetupSessionId: string;
  }) {
    return await this.getBoundSetupSession({
      ...d,
      requireCompleted: true
    });
  }

  private async getBoundSetupSession(d: {
    instance: Instance;
    integrationSetupSessionId: string;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    providerTemplate: Pick<ProviderTemplate, 'oid'>;
    requireCompleted?: boolean;
  }) {
    let binding = await db.consumerProviderSetupSessionBinding.findUnique({
      where: {
        instanceOid_providerSetupSessionId: {
          instanceOid: d.instance.oid,
          providerSetupSessionId: d.integrationSetupSessionId
        }
      },
      select: {
        consumerProfileOid: true,
        providerTemplateOid: true,
        type: true
      }
    });

    assertSetupSessionBindingMatchesConsumerProvider({
      binding,
      consumerProfile: d.consumerProfile,
      providerTemplate: d.providerTemplate
    });

    if (binding?.type == 'provider_setup_session') {
      // let setupSession = await subspaceProviderSetupSessionService.get({
      //   instance: d.instance,
      //   providerSetupSessionId: d.integrationSetupSessionId
      // });

      // if (
      //   d.requireCompleted &&
      //   (setupSession.status != 'completed' || !setupSession.authConfig?.id)
      // ) {
      //   throw new ServiceError(
      //     preconditionFailedError({
      //       message: 'The selected setup session is not completed yet.'
      //     })
      //   );
      // }

      // return setupSession;

      throw new ServiceError(
        preconditionFailedError({
          message: 'The selected setup session is not an integration setup session.'
        })
      );
    }

    let setupSession = await integrationSetupSessionService.getIntegrationSetupSessionById({
      instance: d.instance,
      integrationSetupSessionId: d.integrationSetupSessionId
    });

    if (d.requireCompleted && setupSession.status != 'successful') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The selected setup session is not completed yet.'
        })
      );
    }

    return setupSession;
  }
}

export let consumerProviderSetupSessionService = Service.create(
  'consumerProviderSetupSessionService',
  () => new ConsumerProviderSetupSessionServiceImpl()
).build();
