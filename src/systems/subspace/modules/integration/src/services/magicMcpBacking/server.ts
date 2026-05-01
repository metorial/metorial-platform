import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  ephemeralManagedSessionService,
  sessionTemplateProviderService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { integrationService } from '../integration';
import { integrationInstanceService } from '../integrationInstance';
import { integrationInstanceProviderService } from '../integrationInstanceProvider';
import {
  type BackingProviderInput,
  type MagicMcpBackingInputBase,
  magicMcpProviderTemplateBackingInclude,
  magicMcpServerBackingInclude,
  resolveActorOid,
  withMagicMcpBackingLock
} from './shared';

type UpsertMagicMcpServerBackingInput = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: MagicMcpBackingInputBase & {
    providerTemplateBackingId?: string | null;
    providers?: BackingProviderInput[];
  };
};

class magicMcpServerBackingServiceImpl {
  async upsertMagicMcpServerBacking(d: UpsertMagicMcpServerBackingInput) {
    let actorOid = await resolveActorOid({ ...d, identityActorId: d.input.identityActorId });
    let providerTemplateBacking = d.input.providerTemplateBackingId
      ? await db.providerTemplateBacking.findUnique({
          where: { id: d.input.providerTemplateBackingId },
          include: magicMcpProviderTemplateBackingInclude
        })
      : null;
    if (d.input.providerTemplateBackingId && !providerTemplateBacking) {
      throw new ServiceError(
        notFoundError('provider_template.backing', d.input.providerTemplateBackingId)
      );
    }

    await withMagicMcpBackingLock(
      `server:${d.tenant.id}:${d.solution.id}:${d.environment.id}:${d.input.id}`,
      async () =>
        await withTransaction(async tx => {
          let existing = await tx.magicMcpServerBacking.findUnique({
            where: { id: d.input.id },
            include: magicMcpServerBackingInclude
          });

          let integration = await integrationService.upsertMagicMcpIntegration({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            integration: providerTemplateBacking?.integration ?? existing?.integration,
            input: {
              slug: `magic-mcp-server-${d.input.id}`,
              name: d.input.name?.trim() || d.input.id,
              description: d.input.description,
              metadata: d.input.metadata,
              privateMetadata: d.input.privateMetadata,
              canAttachCustomToolFilters: true,
              canAttachCustomProviderConfig: providerTemplateBacking ? undefined : true,
              canOverrideToolFilters: providerTemplateBacking ? undefined : true
            }
          });

          let integrationInstance =
            await integrationInstanceService.upsertMagicMcpIntegrationInstance({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integration,
              integrationInstance: existing?.integrationInstance,
              input: {
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata,
                identityActorId: d.input.identityActorId
              }
            });

          let sessionTemplate =
            await sessionTemplateService.upsertInternalLinkedSessionTemplate({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              sessionTemplate: existing?.sessionTemplate,
              input: {
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata,
                integrationInstance
              }
            });

          let ephemeralManagedSession =
            await ephemeralManagedSessionService.upsertPlaceholderEphemeralManagedSession({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              ephemeralManagedSession: existing?.ephemeralManagedSession,
              sessionTemplate,
              input: {
                maxSessionDurationInMinutes: d.input.maxSessionDurationInMinutes,
                actorOid
              }
            });

          await tx.magicMcpServerBacking.upsert({
            where: { id: d.input.id },
            create: {
              id: d.input.id,
              providerTemplateBackingOid: providerTemplateBacking?.oid,
              integrationOid: providerTemplateBacking ? null : integration.oid,
              integrationInstanceOid: integrationInstance.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid
            },
            update: {
              providerTemplateBackingOid: providerTemplateBacking?.oid ?? null,
              integrationOid: providerTemplateBacking ? null : integration.oid,
              integrationInstanceOid: integrationInstance.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid
            }
          });

          if (d.input.providers?.length) {
            await integrationInstanceProviderService.setMagicMcpIntegrationInstanceProviders({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integration,
              integrationInstance,
              input: d.input.providers
            });
          }

          await sessionTemplateProviderService.syncForIntegrationInstance({
            sessionTemplate,
            integrationInstance
          });
          await sessionTemplateProviderService.syncHash({
            sessionTemplateId: sessionTemplate.id
          });
        })
    );

    return await db.magicMcpServerBacking.findUniqueOrThrow({
      where: { id: d.input.id },
      include: magicMcpServerBackingInclude
    });
  }

  async getMagicMcpServerBackingById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerBackingId: string;
  }) {
    let backing = await db.magicMcpServerBacking.findFirst({
      where: {
        id: d.magicMcpServerBackingId,
        integrationInstance: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpServerBackingInclude
    });
    if (!backing) {
      throw new ServiceError(
        notFoundError('magic_mcp.server_backing', d.magicMcpServerBackingId)
      );
    }

    return backing;
  }

  async archiveMagicMcpServerBacking(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerBackingId: string;
  }) {
    let backing = await this.getMagicMcpServerBackingById(d);
    checkTenant(d, backing.integrationInstance);

    await integrationInstanceService.archiveIntegrationInstance({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      integrationInstance: backing.integrationInstance,
      _canModifyMagicMcpBacking: true
    });
    if (backing.integration) {
      await integrationService.archiveIntegration({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integration: backing.integration,
        _canModifyMagicMcpBacking: true
      });
    }
    await sessionTemplateService.archiveSessionTemplate({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      sessionTemplate: backing.sessionTemplate
    });
    await ephemeralManagedSessionService.archiveEphemeralManagedSession({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      ephemeralManagedSession:
        await ephemeralManagedSessionService.getEphemeralManagedSessionById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          ephemeralManagedSessionId: backing.ephemeralManagedSession.id
        })
    });

    return await this.getMagicMcpServerBackingById(d);
  }
}

export let magicMcpServerBackingService = Service.create(
  'magicMcpServerBacking',
  () => new magicMcpServerBackingServiceImpl()
).build();
