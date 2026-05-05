import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { integrationService } from '../integration';
import { integrationProviderService } from '../integrationProvider';
import { reconcileMagicMcpServerProvidersForBacking } from './serverProvider';
import { magicMcpProviderTemplateBackingInclude, withMagicMcpBackingLock } from './shared';

type UpsertProviderTemplateBackingInput = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: {
    providerTemplateId: string;
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
    providerDeploymentId: string;
    toolFilters?: PrismaJson.ToolFilter | null;
  };
};

class providerTemplateBackingServiceImpl {
  async upsertProviderTemplateBacking(d: UpsertProviderTemplateBackingInput) {
    await withMagicMcpBackingLock(
      `provider_template:${d.input.providerTemplateId}`,
      async () =>
        await withTransaction(async db => {
          let existing = await db.providerTemplateBacking.findUnique({
            where: { id: d.input.providerTemplateId },
            include: magicMcpProviderTemplateBackingInclude
          });

          let integration = await integrationService.upsertMagicMcpIntegration({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            integration: existing?.integration,
            input: {
              slug: `magic-mcp-template-${d.input.providerTemplateId}`,
              name: d.input.name,
              description: d.input.description,
              metadata: d.input.metadata,
              privateMetadata: d.input.privateMetadata,
              canAttachCustomToolFilters: true,
              canAttachCustomProviderConfig: false,
              canOverrideToolFilters: false
            }
          });

          await db.providerTemplateBacking.upsert({
            where: { id: d.input.providerTemplateId },
            create: {
              id: d.input.providerTemplateId,
              integrationOid: integration.oid
            },
            update: {
              integrationOid: integration.oid
            }
          });

          await integrationProviderService.ensureIntegrationProviderForDeployment({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            integration,
            input: {
              providerDeploymentId: d.input.providerDeploymentId,
              toolFilters: d.input.toolFilters
            }
          });
        })
    );

    let backing = await db.providerTemplateBacking.findUniqueOrThrow({
      where: { id: d.input.providerTemplateId },
      include: magicMcpProviderTemplateBackingInclude
    });

    let linkedBackings = await db.magicMcpServerBacking.findMany({
      where: {
        providerTemplateBackingOid: backing.oid
      },
      select: { id: true }
    });
    for (let linkedBacking of linkedBackings) {
      await reconcileMagicMcpServerProvidersForBacking({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingId: linkedBacking.id
      });
    }

    return backing;
  }
}

export let providerTemplateBackingService = Service.create(
  'providerTemplateBacking',
  () => new providerTemplateBackingServiceImpl()
).build();
