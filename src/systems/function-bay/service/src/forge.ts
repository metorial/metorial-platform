import { canonicalize } from '@mtsrc/canonicalize';
import { delay } from '@mtsrc/delay';
import { Hash } from '@mtsrc/hash';
import { createForgeClient } from '@metorial-platform-systems/forge-client';
import type { Runtime, Tenant } from '../prisma/generated/client';
import { db } from './db';
import { env } from './env';
import { snowflake } from './id';

export let forge: ReturnType<typeof createForgeClient> = createForgeClient({
  endpoint: env.forge.FORGE_API_URL
});

export type ForgeWorkflowStep =
  | {
      name: string;
      type: 'script';
      initScript: string[] | undefined;
      actionScript: string[];
      cleanupScript: string[] | undefined;
    }
  | {
      name: string;
      type: 'download_artifact';
      artifactId: string;
      artifactDestinationPath: string;
    }
  | {
      name: string;
      type: 'upload_artifact';
      artifactSourcePath: string;
      artifactName: string;
    };

(async () => {
  while (true) {
    console.log('Running forge connection test');
    try {
      let testTenant = await forge.tenant.upsert({
        identifier: 'function-bay-test',
        name: 'FUNCTION BAY test'
      });
      console.log('Was able to create test tenant with forge', testTenant.id);
      return;
    } catch (err) {
      console.log('Unable to create forge test tenant', err);
    }

    await delay(5000);
  }
})();

export let ensureForgeTenant = async (tenant: Tenant) =>
  await forge.tenant.upsert({
    name: tenant.name,
    identifier: tenant.identifier
  });

export let ensureForgeWorkflow = async (d: {
  tenant: Tenant;
  runtime: Runtime;

  steps: ForgeWorkflowStep[];
}) => {
  let workflow = await db.runtimeForgeWorkflow.findUnique({
    where: {
      runtimeOid_tenantOid: {
        runtimeOid: d.runtime.oid,
        tenantOid: d.tenant.oid
      }
    }
  });

  if (workflow) {
    return await forge.workflow.get({
      tenantId: workflow.forgeTenantId,
      workflowId: workflow.forgeWorkflowId
    });
  }

  let tenant = await ensureForgeTenant(d.tenant);

  let createdWorkflow = await forge.workflow.upsert({
    tenantId: tenant.id,
    identifier: `fncbay_builder_${d.runtime.identifier}`,
    name: `Function Bay Builder for ${d.runtime.name}`
  });

  let hash = await Hash.sha256(canonicalize(d.steps));

  let version = await forge.workflowVersion.create({
    tenantId: tenant.id,
    workflowId: createdWorkflow.id,
    name: `Function Bay (${hash.slice(0, 8)})`,
    steps: d.steps
  });

  // Upsert to avoid race conditions
  await db.runtimeForgeWorkflow.upsert({
    where: {
      runtimeOid_tenantOid: {
        runtimeOid: d.runtime.oid,
        tenantOid: d.tenant.oid
      }
    },
    create: {
      oid: await snowflake.nextId(),
      runtimeOid: d.runtime.oid,
      tenantOid: d.tenant.oid,
      forgeWorkflowId: createdWorkflow.id,
      forgeTenantId: tenant.id,
      forgeWorkflowVersionId: version.id
    },
    update: {}
  });

  return createdWorkflow;
};
