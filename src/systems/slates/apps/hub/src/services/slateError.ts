import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlateErrorType, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { recordSlateErrorQueue } from '../queues/error/record';

export type RecordSlateErrorInput = {
  type: SlateErrorType;
  errorCode: string;
  errorMessage: string;

  tenantOid: bigint;
  slateOid?: bigint | null;
  slateVersionOid?: bigint | null;
  slateInstanceOid?: bigint | null;
  invocationOid?: bigint | null;
  toolCallOid?: bigint | null;
  sessionOid?: bigint | null;
  authConfigOid?: bigint | null;
  instanceConfigOid?: bigint | null;
  oauthSetupOid?: bigint | null;
  triggerReceiverOid?: bigint | null;
  triggerEventInputOid?: bigint | null;
};

let listInclude = {
  tenant: true,
  slate: true,
  slateVersion: true,
  slateInstance: true,
  invocation: {
    include: {
      slateInvocationAttachment: {
        include: {
          attachments: true
        }
      }
    }
  }
};

let getInclude = {
  ...listInclude,
  toolCall: {
    include: {
      action: true,
      session: true,
      slateVersion: true,
      invocation: {
        include: {
          slateInvocationAttachment: {
            include: {
              attachments: true
            }
          },
          deployment: {
            include: {
              slateVersion: true
            }
          }
        }
      }
    }
  },
  session: true,
  authConfig: {
    include: {
      authMethod: true,
      oauthCredentials: true,
      slate: true
    }
  },
  instanceConfig: true,
  oauthSetup: {
    include: {
      authMethod: true,
      oauthCredentials: true,
      slateVersion: true,
      events: true
    }
  },
  triggerReceiver: true,
  triggerEventInput: {
    include: {
      receiver: true,
      receiverTrigger: true,
      action: true,
      event: true
    }
  }
};

let toBigIntOrNull = (v: string | null | undefined): bigint | null =>
  v != null ? BigInt(v) : null;

class slateErrorServiceImpl {
  async recordSlateError(d: RecordSlateErrorInput) {
    await recordSlateErrorQueue.add({
      type: d.type,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
      tenantOid: String(d.tenantOid),
      slateOid: d.slateOid != null ? String(d.slateOid) : null,
      slateVersionOid: d.slateVersionOid != null ? String(d.slateVersionOid) : null,
      slateInstanceOid: d.slateInstanceOid != null ? String(d.slateInstanceOid) : null,
      invocationOid: d.invocationOid != null ? String(d.invocationOid) : null,
      toolCallOid: d.toolCallOid != null ? String(d.toolCallOid) : null,
      sessionOid: d.sessionOid != null ? String(d.sessionOid) : null,
      authConfigOid: d.authConfigOid != null ? String(d.authConfigOid) : null,
      instanceConfigOid: d.instanceConfigOid != null ? String(d.instanceConfigOid) : null,
      oauthSetupOid: d.oauthSetupOid != null ? String(d.oauthSetupOid) : null,
      triggerReceiverOid: d.triggerReceiverOid != null ? String(d.triggerReceiverOid) : null,
      triggerEventInputOid:
        d.triggerEventInputOid != null ? String(d.triggerEventInputOid) : null
    });
  }

  async createSlateError(d: {
    type: SlateErrorType;
    errorCode: string;
    errorMessage: string;
    tenantOid: string;
    slateOid: string | null;
    slateVersionOid: string | null;
    slateInstanceOid: string | null;
    invocationOid: string | null;
    toolCallOid: string | null;
    sessionOid: string | null;
    authConfigOid: string | null;
    instanceConfigOid: string | null;
    oauthSetupOid: string | null;
    triggerReceiverOid: string | null;
    triggerEventInputOid: string | null;
  }) {
    return db.slateError.create({
      data: {
        ...getId('slateError'),

        type: d.type,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,

        tenantOid: BigInt(d.tenantOid),
        slateOid: toBigIntOrNull(d.slateOid),
        slateVersionOid: toBigIntOrNull(d.slateVersionOid),
        slateInstanceOid: toBigIntOrNull(d.slateInstanceOid),
        invocationOid: toBigIntOrNull(d.invocationOid),
        toolCallOid: toBigIntOrNull(d.toolCallOid),
        sessionOid: toBigIntOrNull(d.sessionOid),
        authConfigOid: toBigIntOrNull(d.authConfigOid),
        instanceConfigOid: toBigIntOrNull(d.instanceConfigOid),
        oauthSetupOid: toBigIntOrNull(d.oauthSetupOid),
        triggerReceiverOid: toBigIntOrNull(d.triggerReceiverOid),
        triggerEventInputOid: toBigIntOrNull(d.triggerEventInputOid)
      }
    });
  }

  async listSlateErrors(d: {
    tenant?: Tenant;
    types?: SlateErrorType[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateError.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant ? d.tenant.oid : undefined,
              type: d.types?.length ? { in: d.types } : undefined
            },
            orderBy: { oid: 'desc' },
            include: listInclude
          })
      )
    );
  }

  async getSlateError(d: { id: string; tenant?: Tenant }) {
    let error = await db.slateError.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant ? d.tenant.oid : undefined
      },
      include: getInclude
    });
    if (!error) throw new ServiceError(notFoundError('slate.error'));

    return error;
  }
}

export let slateErrorService = Service.create(
  'slateErrorService',
  () => new slateErrorServiceImpl()
).build();
