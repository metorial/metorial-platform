import {
  badRequestError,
  isServiceError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  slatesLinkedOptionList,
  slatesMessageOptionListOptionsListResponse,
  slatesMessageTriggerGroupSelectionOptionsListResponse,
  slatesSelectionOptionsLinkedSchemaKey,
  slatesSelectionOptionsSchemaKey,
  type SlatesTriggerGroup
} from '@slates/proto';
import {
  Prisma,
  type Slate,
  type SlateAuthConfig,
  type SlateInstance,
  type SlateTriggerGroup,
  type Tenant,
  type TriggerRegistration
} from '@mtsrc/slates-hub-db/client';
import { db } from '@mtsrc/slates-hub-db/db';
import { getId } from '@mtsrc/slates-hub-db/id';
import type { InvocationResult } from '@mtsrc/slates-hub-module-invocations/types';
import { getActiveSlateVersion } from '@mtsrc/slates-hub-module-catalog/versionSelection';
import {
  describeSelectableTriggerGroups,
  validateTriggerGroupSelections
} from '../lib/triggerGroupSelection';
import { createTriggerInstanceStack } from '../queues/trigger/_stack';
import { triggerRegistrationCleanupQueue } from '../queues/registration/registrationCleanup';
import { triggerRegistrationInstanceSetupQueue } from '../queues/registration/setup';
import { slateService } from '@mtsrc/slates-hub-module-catalog/slate';
import { slateInvocationService } from '@mtsrc/slates-hub-module-invocations/slateInvocation';

let SELECTION_OPTIONS_QUERY_MAX_LENGTH = 200;
let SELECTION_OPTIONS_SELECTION_MAX_BYTES = 64 * 1024;

let include = {
  slate: true,
  instance: true,
  instanceConfig: true,
  authConfig: { include: { authMethod: true } },
  instances: { include: { triggerGroup: true, schedule: true } }
};

let listActiveTriggerGroups = async (d: { slate: Slate; instance: SlateInstance }) => {
  let version = await getActiveSlateVersion(d);
  if (!version.specificationOid) {
    throw new ServiceError(
      badRequestError({ message: 'Provider version has no specification set.' })
    );
  }

  return db.slateTriggerGroup.findMany({
    where: {
      slateOid: d.slate.oid,
      slateSpecifications: { some: { specificationOid: version.specificationOid } }
    }
  });
};

let describeGroups = (groups: SlateTriggerGroup[], selectionRequiredKeys: Set<string>) =>
  describeSelectableTriggerGroups(
    groups.map(group => ({
      key: group.key,
      name: group.name,
      spec: group.spec as SlatesTriggerGroup
    })),
    selectionRequiredKeys
  );

type SelectionOptionsSource = 'own' | 'linked';

let unwrapSelectionOptions = (
  result: InvocationResult<
    'slates/trigger_group.selection.options_list' | 'slates/option_list.options_list'
  >,
  resultSchema:
    | typeof slatesMessageTriggerGroupSelectionOptionsListResponse.shape.result
    | typeof slatesMessageOptionListOptionsListResponse.shape.result
) => {
  if (result.status === 'error') {
    throw new ServiceError(
      badRequestError({
        code: 'selection_options_failed',
        message: result.error.message
      })
    );
  }

  let parsed = resultSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new ServiceError(
      badRequestError({
        code: 'selection_options_failed',
        message: 'The integration returned the options in an unexpected format.'
      })
    );
  }

  return {
    options: parsed.data.options,
    nextPageToken: parsed.data.nextPageToken ?? null
  };
};

class triggerRegistrationServiceImpl {
  async getTriggerRegistrationById(d: { tenant: Tenant; id: string }) {
    let registration = await db.triggerRegistration.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.id, status: { not: 'deleted' } },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('trigger_registration'));
    return registration;
  }

  async listTriggerRegistrations(d: { tenant: Tenant; slateInstanceIds?: string[] }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.triggerRegistration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              status: { not: 'deleted' },
              instanceOid: slateInstances
                ? { in: slateInstances.map(si => si.oid) }
                : undefined
            },
            include
          })
      )
    );
  }

  async getManyTriggerRegistrationsByIds(d: { tenant: Tenant; ids: string[] }) {
    return db.triggerRegistration.findMany({
      where: { tenantOid: d.tenant.oid, id: { in: d.ids }, status: { not: 'deleted' } },
      include
    });
  }

  async createTriggerRegistration(d: {
    tenant: Tenant;
    input: {
      slateInstanceId: string;
      authConfigId?: string;
      triggerGroupSelections?: Record<string, Record<string, any>>;
    };
  }) {
    let slateInstance = await db.slateInstance.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.input.slateInstanceId },
      include: { slate: true, currentConfig: true }
    });
    if (!slateInstance) throw new ServiceError(notFoundError('slate.instance'));
    if (!slateInstance.currentConfig) {
      throw new ServiceError(
        badRequestError({ message: 'This provider instance has no configuration set.' })
      );
    }

    let authMethods = await slateService.listCurrentAuthMethods({
      slate: slateInstance.slate
    });

    let authConfig = null;
    if (d.input.authConfigId) {
      authConfig = await db.slateAuthConfig.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          id: d.input.authConfigId,
          slateOid: slateInstance.slateOid
        }
      });
      if (!authConfig) throw new ServiceError(notFoundError('slate.auth_config'));
      if (authConfig.instanceOid && authConfig.instanceOid !== slateInstance.oid) {
        throw new ServiceError(
          badRequestError({
            message:
              'This authentication configuration is not valid for the selected provider instance.'
          })
        );
      }
    } else if (authMethods.length > 0) {
      throw new ServiceError(
        badRequestError({
          code: 'authentication_required',
          message: 'This provider requires authentication - provide an authConfigId.'
        })
      );
    }

    let triggerGroups = await listActiveTriggerGroups({
      slate: slateInstance.slate,
      instance: slateInstance
    });

    let { selections, skippedGroupIds, ignoredSelectionKeys } = validateTriggerGroupSelections(
      triggerGroups.map(group => ({ ...group.spec, id: group.key })),
      d.input.triggerGroupSelections
    );
    let activeTriggerGroups = triggerGroups.filter(group => !skippedGroupIds.has(group.key));
    let selectableTriggerGroups = describeGroups(triggerGroups, skippedGroupIds);

    let registrationOid = await db.$transaction(async db => {
      let registration = await db.triggerRegistration.create({
        data: {
          ...getId('triggerRegistration'),
          tenantOid: d.tenant.oid,
          slateOid: slateInstance.slateOid,
          instanceOid: slateInstance.oid,
          instanceConfigOid: slateInstance.currentConfig!.oid,
          authConfigOid: authConfig?.oid
        }
      });

      if (activeTriggerGroups.length > 0) {
        await db.triggerRegistrationInstance.createMany({
          data: activeTriggerGroups.map(triggerGroup => ({
            ...getId('triggerRegistrationInstance'),
            triggerRegistrationOid: registration.oid,
            triggerGroupOid: triggerGroup.oid,
            selection: selections.get(triggerGroup.key) ?? Prisma.DbNull
          }))
        });
      }

      return registration.oid;
    });

    let instances = await db.triggerRegistrationInstance.findMany({
      where: { triggerRegistrationOid: registrationOid },
      select: { id: true }
    });
    if (instances.length > 0) {
      await triggerRegistrationInstanceSetupQueue.addManyWithOps(
        instances.map(instance => ({
          data: { triggerRegistrationInstanceId: instance.id },
          opts: { id: instance.id }
        }))
      );
    }

    let registration = await db.triggerRegistration.findUniqueOrThrow({
      where: { oid: registrationOid },
      include
    });

    return { ...registration, selectableTriggerGroups, ignoredSelectionKeys };
  }

  async listSelectableTriggerGroups(d: {
    registration: TriggerRegistration & {
      slate: Slate;
      instance: SlateInstance;
      instances: { triggerGroupOid: bigint }[];
    };
  }) {
    // Reading a registration must not fail because its provider has no deployable version.
    let triggerGroups = await listActiveTriggerGroups(d.registration).catch(error => {
      if (isServiceError(error)) return [];
      throw error;
    });
    let registered = new Set(d.registration.instances.map(i => i.triggerGroupOid));

    return describeGroups(
      triggerGroups,
      new Set(triggerGroups.filter(g => !registered.has(g.oid)).map(g => g.key))
    );
  }

  async listSelectionOptions(d: {
    tenant: Tenant;
    registration: Prisma.TriggerRegistrationGetPayload<{ include: typeof include }>;
    input: {
      triggerGroupKey: string;
      field: string;
      query?: string;
      pageToken?: any;
      pageTokenSource?: SelectionOptionsSource;
      selection?: Record<string, any>;
      linkedAuthConfigIds?: string[];
    };
  }) {
    if (
      Buffer.byteLength(JSON.stringify(d.input.selection ?? {})) >
      SELECTION_OPTIONS_SELECTION_MAX_BYTES
    ) {
      throw new ServiceError(badRequestError({ message: 'The selection is too large.' }));
    }

    let triggerGroups = await listActiveTriggerGroups(d.registration);
    let triggerGroup = triggerGroups.find(group => group.key === d.input.triggerGroupKey);
    let properties = (triggerGroup?.spec as SlatesTriggerGroup | undefined)?.selectionSchema
      ?.properties;
    let field =
      properties && Object.hasOwn(properties, d.input.field)
        ? properties[d.input.field]
        : undefined;
    let hasOwnList = field?.[slatesSelectionOptionsSchemaKey] === true;
    let linkedMarker = slatesLinkedOptionList.safeParse(
      field?.[slatesSelectionOptionsLinkedSchemaKey]
    );
    let linkedList = linkedMarker.success ? linkedMarker.data : null;
    if (!hasOwnList && !linkedList) {
      throw new ServiceError(
        badRequestError({
          code: 'selection_options_not_supported',
          message: 'This trigger has no list of options for that field.'
        })
      );
    }

    let query = d.input.query?.slice(0, SELECTION_OPTIONS_QUERY_MAX_LENGTH);
    let linkedSource = linkedList
      ? await this.findLinkedOptionSource({
          tenant: d.tenant,
          registration: d.registration,
          slateIdentifier: linkedList.slate,
          linkedAuthConfigIds: d.input.linkedAuthConfigIds ?? []
        })
      : null;
    let linked = linkedSource ? { connected: !!linkedSource.connection } : null;

    let source: SelectionOptionsSource =
      linkedList && linkedSource?.connection ? 'linked' : 'own';
    if (
      d.input.pageToken !== undefined &&
      d.input.pageToken !== null &&
      d.input.pageTokenSource !== source
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'selection_options_page_token_expired',
          message:
            'The list of options has changed since this page token was issued. Start again from the first page.'
        })
      );
    }

    if (linkedList && linkedSource?.connection) {
      let stack = await createTriggerInstanceStack({
        ...linkedSource.connection,
        sessionId: d.registration.id,
        note: `trigger-linked-options:${d.registration.id}`
      });

      let result = await slateInvocationService.listOptionListOptions({
        stack,
        optionListId: linkedList.optionList,
        params: linkedList.params,
        query,
        pageToken: d.input.pageToken
      });

      return {
        ...unwrapSelectionOptions(
          result,
          slatesMessageOptionListOptionsListResponse.shape.result
        ),
        source,
        linked
      };
    }

    if (!hasOwnList) {
      return { options: [], nextPageToken: null, source, linked };
    }

    let stack = await createTriggerInstanceStack({
      registration: { ...d.registration, tenant: d.tenant },
      sessionId: d.registration.id,
      note: `trigger-selection-options:${d.registration.id}`
    });

    let result = await slateInvocationService.listTriggerSelectionOptions({
      stack,
      triggerGroupId: d.input.triggerGroupKey,
      field: d.input.field,
      query,
      pageToken: d.input.pageToken,
      selection: d.input.selection
    });

    return {
      ...unwrapSelectionOptions(
        result,
        slatesMessageTriggerGroupSelectionOptionsListResponse.shape.result
      ),
      source,
      linked
    };
  }

  async deleteTriggerRegistration(d: { tenant: Tenant; registration: TriggerRegistration }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('trigger_registration'));
    }

    await db.triggerRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });

    await triggerRegistrationCleanupQueue.add(
      { triggerRegistrationId: d.registration.id },
      { id: d.registration.id }
    );
  }

  private async findLinkedOptionSource(d: {
    tenant: Tenant;
    registration: TriggerRegistration & { slate: Slate; authConfig: SlateAuthConfig | null };
    slateIdentifier: string;
    linkedAuthConfigIds: string[];
  }) {
    let fullIdentifier = d.slateIdentifier.replace(/^@/, '');
    let slate = await db.slate.findFirst({
      where: {
        registryOid: d.registration.slate.registryOid,
        status: 'active',
        slateFullIdentifierOnRegistry: { in: [fullIdentifier, `@${fullIdentifier}`] }
      }
    });
    if (!slate) return null;

    let profileUid = d.registration.authConfig?.profileUid;
    if (!profileUid || !d.linkedAuthConfigIds.length) return { slate, connection: null };

    let authConfig = await db.slateAuthConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.linkedAuthConfigIds },
        slateOid: slate.oid,
        profileUid,
        isProcessing: false,
        errorCode: null,
        secret: { status: 'active' }
      },
      orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
      include: { authMethod: true, instance: { include: { currentConfig: true } } }
    });
    if (!authConfig) return { slate, connection: null };

    // Connections are usually created without an instance, so the config comes from the newest
    // instance the connection has been used with; without one the list runs with an empty config.
    let usage = authConfig.instance
      ? null
      : await db.slateAuthConfigUsedForInstance.findFirst({
          where: {
            configOid: authConfig.oid,
            instance: { tenantOid: d.tenant.oid, slateOid: slate.oid }
          },
          orderBy: { createdAt: 'desc' },
          include: { instance: { include: { currentConfig: true } } }
        });
    let instance = authConfig.instance ?? usage?.instance ?? null;

    let slateVersion = await getActiveSlateVersion({ slate, instance }).catch(error => {
      if (isServiceError(error)) return null;
      throw error;
    });
    if (!slateVersion) return { slate, connection: null };

    return {
      slate,
      connection: {
        slateVersion,
        registration: {
          tenant: d.tenant,
          slate,
          authConfig,
          instance,
          instanceConfig: instance?.currentConfig ?? null
        }
      }
    };
  }
}

export let triggerRegistrationService = Service.create(
  'triggerRegistrationService',
  () => new triggerRegistrationServiceImpl()
).build();
