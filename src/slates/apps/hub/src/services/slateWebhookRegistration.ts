import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCustomId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  SlateWebhookRegistrationType,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import { validateJsonSchema } from '../lib/validateJsonSchema';
import { secretService } from './secret';
import { slateService } from './slate';
import { slateInvocationService } from './slateInvocation';

let include = {
  instance: true,
  instanceConfig: true,
  authConfig: true,
  slate: true,
  triggerGroup: true
};

let getRegion = () => {
  let region =
    env.service.METORIAL_REGION ??
    (env.service.METORIAL_ENV !== 'production' ? 'dev' : undefined);
  if (!region)
    throw new Error('METORIAL_REGION is required to generate webhook registrations');
  if (!/^[a-z0-9-]+$/.test(region)) throw new Error(`Invalid METORIAL_REGION: ${region}`);
  return region;
};

export let generateWebhookRegistrationUrlKey = () =>
  `${generateCustomId('whk_')}_${getRegion()}`;

let getWebhookUrl = (registration: Pick<SlateWebhookRegistration, 'urlKey'>) =>
  `${env.service.SERVICE_PUBLIC_URL}/receive/${registration.urlKey}`;

let getManualWebhookRegistrationSpec = (triggerGroup: SlateTriggerGroup) => {
  let invocation = triggerGroup.spec.invocation;
  if (invocation.type !== 'webhook' || invocation.registration.mode !== 'manual') return null;
  return invocation.registration;
};

class slateWebhookRegistrationServiceImpl {
  async getWebhookRegistrationById(d: {
    tenant: Tenant;
    id: string;
    type?: SlateWebhookRegistrationType;
  }) {
    let registration = await db.slateWebhookRegistration.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id,
        status: { not: 'deleted' },
        type: d.type
      },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('slate.webhook_registration'));
    return registration;
  }

  async getWebhookRegistrationByUrlKey(d: { urlKey: string }) {
    let registration = await db.slateWebhookRegistration.findUnique({
      where: { urlKey: d.urlKey },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('slate.webhook_registration'));
    return registration;
  }

  async listWebhookRegistrations(d: {
    tenant: Tenant;
    slateInstanceIds?: string[];
    type?: SlateWebhookRegistrationType;
  }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookRegistration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              status: { not: 'deleted' },
              type: d.type,
              instanceOid: slateInstances
                ? { in: slateInstances.map(si => si.oid) }
                : undefined
            },
            include
          })
      )
    );
  }

  async createManualWebhookSetup(d: {
    tenant: Tenant;
    input: {
      slateId: string;
      name: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    let slate = await slateService.getSlateById({ id: d.input.slateId });

    let triggerGroups = await db.slateTriggerGroup.findMany({
      where: { slateOid: slate.oid }
    });
    let manualWebhookTriggerGroups = triggerGroups.filter(
      tg => getManualWebhookRegistrationSpec(tg) !== null
    );

    if (manualWebhookTriggerGroups.length === 0) {
      throw new ServiceError(
        badRequestError({
          message: 'The provider does not support webhook registration.'
        })
      );
    }
    if (manualWebhookTriggerGroups.length > 1) {
      throw new Error('WTF - multiple manual webhook trigger groups found for provider');
    }

    let triggerGroup = manualWebhookTriggerGroups[0]!;

    let version = await this.getVersion({ slate });

    let urlKey = generateWebhookRegistrationUrlKey();

    let setupRes = await slateInvocationService.startManualWebhookRegistration({
      stack: await slateInvocationService.createInvocation({
        participants: [],
        slateVersion: version,
        tenant: d.tenant
      }),
      triggerGroupId: triggerGroup.key,
      webhookUrl: getWebhookUrl({ urlKey })
    });

    if (setupRes.status === 'error') {
      throw new ServiceError(
        badRequestError({
          message: `Unable to start webhook setup: ${setupRes.error.message}`
        })
      );
    }

    let secret = await secretService.createSecret({
      tenant: d.tenant,
      purpose: 'slate_webhook_registration_payload',
      secretData: { payload: setupRes.data.partialWebhookRegistrationPayload }
    });

    let registration = await db.slateWebhookRegistration.create({
      data: {
        ...getId('slateWebhookRegistration'),
        type: 'manual',
        status: 'awaiting_setup',
        urlKey: generateWebhookRegistrationUrlKey(),

        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,

        tenantOid: d.tenant.oid,
        slateOid: slate.oid,
        triggerGroupOid: triggerGroup.oid,
        secretOid: secret.oid
      },
      include
    });

    return {
      registration,
      webhookSetupDocument: setupRes.data.webhookSetupDocument
    };
  }

  async finishManualWebhookSetup(d: {
    tenant: Tenant;
    registration: SlateWebhookRegistration & {
      slate: Slate | null;
      triggerGroup: SlateTriggerGroup | null;
    };
    input: { userConfig: Record<string, any> };
  }) {
    if (d.registration.status !== 'awaiting_setup') {
      throw new ServiceError(
        badRequestError({ message: 'This webhook registration is not awaiting setup.' })
      );
    }
    if (!d.registration.slate || !d.registration.triggerGroup || !d.registration.secretOid) {
      throw new ServiceError(
        badRequestError({ message: 'This webhook registration is missing setup data.' })
      );
    }
    let registrationSpec = getManualWebhookRegistrationSpec(d.registration.triggerGroup);
    if (!registrationSpec) {
      throw new ServiceError(
        badRequestError({
          message: 'This trigger group no longer supports manual webhook registration.'
        })
      );
    }

    let userConfig = validateJsonSchema({
      schema: registrationSpec.userConfigSchema,
      data: d.input.userConfig,
      entity: 'slate.webhook_registration.user_config',
      message: 'Invalid webhook setup configuration.'
    });

    let partial = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: d.registration.secretOid,
      purpose: 'slate_webhook_registration_payload',
      tenant: d.tenant,
      note: `webhook-manual-finish:${d.registration.id}`
    });

    let version = await this.getVersion({ slate: d.registration.slate });

    let finishRes = await slateInvocationService.finishManualWebhookRegistration({
      stack: await slateInvocationService.createInvocation({
        participants: [],
        slateVersion: version,
        tenant: d.tenant
      }),
      triggerGroupId: d.registration.triggerGroup.key,
      webhookUrl: getWebhookUrl(d.registration),
      partialWebhookRegistrationPayload: partial.payload,
      userWebhookRegistrationPayload: userConfig
    });

    if (finishRes.status === 'error') {
      throw new ServiceError(
        badRequestError({
          message: `Unable to finish webhook setup: ${finishRes.error.message}`
        })
      );
    }

    await secretService.DANGEROUSLY_updateSecret({
      secretOid: d.registration.secretOid,
      purpose: 'slate_webhook_registration_payload',
      tenant: d.tenant,
      secretData: { payload: finishRes.data.webhookRegistrationPayload }
    });

    return db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'active' },
      include
    });
  }

  async updateWebhookRegistration(d: {
    tenant: Tenant;
    registration: { oid: bigint; tenantOid: bigint };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('slate.webhook_registration'));
    }

    return db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      },
      include
    });
  }

  async deleteWebhookRegistration(d: {
    tenant: Tenant;
    registration: { oid: bigint; tenantOid: bigint };
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('slate.webhook_registration'));
    }

    await db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });
  }

  private async getVersion(d: { slate: Slate }) {
    if (!d.slate.currentVersionOid) {
      throw new ServiceError(
        badRequestError({ message: 'Provider does not have a current version set.' })
      );
    }

    let fullVersion = await db.slateVersion.findFirstOrThrow({
      where: { slateOid: d.slate.oid, oid: d.slate.currentVersionOid }
    });
    if (fullVersion.status !== 'active' || !fullVersion.activeDeploymentOid) {
      throw new ServiceError(
        badRequestError({ message: 'Provider version has not been deployed yet.' })
      );
    }

    return fullVersion;
  }
}

export let slateWebhookRegistrationService = Service.create(
  'slateWebhookRegistrationService',
  () => new slateWebhookRegistrationServiceImpl()
).build();
