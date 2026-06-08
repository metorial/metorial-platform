import { beforeEach, describe, expect, it } from 'vitest';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('cargo reconcile.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('idempotently reconciles purposes, files, links, and references', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-reconcile',
      name: 'Tenant Reconcile'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'dev',
      name: 'Development',
      type: 'development'
    });

    let reconciledPurposes = await cargoClient.reconcile.purposes({
      items: [
        {
          id: 'cfp_fixed',
          slug: 'organization_image',
          name: 'Organization Image',
          ownerType: 'organization',
          canHaveLinks: true
        }
      ]
    });

    let reconciledFiles = await cargoClient.reconcile.files({
      tenantId: tenant.id,
      environmentId: environment.id,
      items: [
        {
          id: 'cfi_fixed',
          storeId: 'store-fixed',
          purpose: reconciledPurposes[0]!.id,
          name: 'reconciled.png',
          mimeType: 'image/png',
          size: 321,
          links: [
            {
              id: 'cfl_fixed',
              key: 'fixed_key',
              references: [
                {
                  id: 'cfr_fixed',
                  entityType: 'organization',
                  entityId: 'org_123'
                }
              ]
            }
          ]
        }
      ]
    });

    let repeated = await cargoClient.reconcile.files({
      tenantId: tenant.id,
      environmentId: environment.id,
      items: [
        {
          id: 'cfi_fixed',
          storeId: 'store-fixed',
          purpose: reconciledPurposes[0]!.id,
          name: 'reconciled.png',
          mimeType: 'image/png',
          size: 321,
          links: [
            {
              id: 'cfl_fixed',
              key: 'fixed_key',
              references: [
                {
                  id: 'cfr_fixed',
                  entityType: 'organization',
                  entityId: 'org_123'
                }
              ]
            }
          ]
        }
      ]
    });

    expect(reconciledPurposes[0]!.id).toBe('cfp_fixed');
    expect(reconciledFiles[0]!.file.id).toBe('cfi_fixed');
    expect(reconciledFiles[0]!.links[0]!.link.id).toBe('cfl_fixed');
    expect(reconciledFiles[0]!.links[0]!.references[0]!.id).toBe('cfr_fixed');
    expect(repeated[0]!.file.id).toBe('cfi_fixed');
    expect(repeated[0]!.links[0]!.link.id).toBe('cfl_fixed');
    expect(repeated[0]!.links[0]!.references[0]!.id).toBe('cfr_fixed');

    let listed = await cargoClient.fileReference.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]!.id).toBe('cfr_fixed');
  });
});
