import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlatesParticipant } from '@slates/proto';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { ensureSlateInvocationAttachment } from '../lib/invocation/attachments';
import { slateInvocationService } from './slateInvocation';

let include = {
  action: true,
  invocation: {
    include: {
      slateInvocationAttachment: {
        include: {
          attachments: true
        }
      }
    }
  },
  slate: true,
  slateVersion: true
};

class slatePublicToolCallServiceImpl {
  async createPublicToolCall(d: {
    input: {
      tenantId: string;
      slateId: string;
      slateVersionId?: string;
      toolId: string;
      enclaveId?: string;
      egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
      input: Record<string, any>;
      participants: SlatesParticipant[];
    };
  }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.input.tenantId }, { identifier: d.input.tenantId }] }
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));

    let slate = await db.slate.findFirst({
      where: { OR: [{ id: d.input.slateId }, { identifier: d.input.slateId }] }
    });
    if (!slate) throw new ServiceError(notFoundError('slate'));

    if (!d.input.slateVersionId && !slate.currentVersionOid) {
      throw new ServiceError(
        badRequestError({ message: 'Provider does not have a current version set.' })
      );
    }

    let version = await db.slateVersion.findFirst({
      where: {
        slateOid: slate.oid,
        ...(d.input.slateVersionId
          ? { OR: [{ id: d.input.slateVersionId }, { version: d.input.slateVersionId }] }
          : { oid: slate.currentVersionOid! })
      },
      include: { specification: true }
    });
    if (!version) throw new ServiceError(notFoundError('slate.version'));
    if (version.status !== 'active' || !version.activeDeploymentOid || !version.specification) {
      throw new ServiceError(
        badRequestError({ message: 'Provider version has not been deployed yet.' })
      );
    }

    let action = await db.slateAction.findFirst({
      where: {
        type: 'tool',
        slateOid: slate.oid,
        slateSpecifications: { some: { specificationOid: version.specification.oid } },
        OR: [{ id: d.input.toolId }, { key: d.input.toolId }, { identifier: d.input.toolId }]
      }
    });
    if (!action) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_tool_action',
          message: 'Tool action not found for this provider.'
        })
      );
    }
    if (!action.isPublic) {
      throw new ServiceError(
        badRequestError({
          code: 'not_a_public_tool',
          message: 'This tool action is not a public tool.'
        })
      );
    }

    let startTime = Date.now();

    let stack = await slateInvocationService.createInvocation({
      tenant,
      slateVersion: version,
      participants: d.input.participants,
      enclaveId: d.input.enclaveId,
      egressPolicy: d.input.egressPolicy
    });
    let callRes = await slateInvocationService.invokeToolAction({
      stack,
      actionId: action.key,
      input: d.input.input
    });

    let durationMs = Date.now() - startTime;

    let call = await db.slatePublicToolCall.create({
      data: {
        ...getId('slatePublicToolCall'),

        status: callRes.status === 'success' ? 'succeeded' : 'failed',
        errorCode: callRes.status === 'error' ? callRes.error.code : null,
        errorMessage: callRes.status === 'error' ? callRes.error.message : null,
        durationMs,

        tenantOid: tenant.oid,
        actionOid: action.oid,
        invocationOid: callRes.invocation.oid,
        slateOid: slate.oid,
        slateVersionOid: version.oid
      }
    });

    if (callRes.status === 'error') {
      return {
        status: 'error' as const,
        call,
        invocationId: callRes.invocation.id,
        error: callRes.error
      };
    }

    let attachments = await Promise.all(
      (callRes.data.attachments ?? []).map(attachment =>
        ensureSlateInvocationAttachment({
          content: attachment.content,
          mimeType: attachment.mimeType,
          invocation: callRes.invocation
        })
      )
    );

    return {
      call,
      invocationId: callRes.invocation.id,
      status: 'success' as const,

      output: callRes.data.output,
      message: callRes.data.message,
      attachments
    };
  }

  async getPublicToolCallById(d: { tenant: Tenant; id: string }) {
    let slatePublicToolCall = await db.slatePublicToolCall.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!slatePublicToolCall) throw new ServiceError(notFoundError('slate.public_tool_call'));
    return slatePublicToolCall;
  }

  async listPublicToolCalls(d: {
    tenant: Tenant;
    slateIds?: string[];
    slateVersionIds?: string[];
    toolIds?: string[];
  }) {
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: { id: { in: d.slateIds } }
        })
      : undefined;
    let slateVersions = d.slateVersionIds
      ? await db.slateVersion.findMany({
          where: { id: { in: d.slateVersionIds } }
        })
      : undefined;
    let tools = d.toolIds
      ? await db.slateAction.findMany({
          where: { id: { in: d.toolIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slatePublicToolCall.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,

              AND: [
                ...(tools ? [{ actionOid: { in: tools.map(t => t.oid) } }] : []),
                ...(slateVersions
                  ? [{ slateVersionOid: { in: slateVersions.map(sv => sv.oid) } }]
                  : []),
                ...(slates ? [{ slateOid: { in: slates.map(s => s.oid) } }] : [])
              ]
            },
            include
          })
      )
    );
  }

  async getManyPublicToolCallsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slatePublicToolCall.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slatePublicToolCallService = Service.create(
  'slatePublicToolCallService',
  () => new slatePublicToolCallServiceImpl()
).build();
