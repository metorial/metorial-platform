import { expectServiceError, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import { createTenant } from '../support/fixtures';

describe('ai-gateway scope api', () => {
  describe('organizations', () => {
    it('upserts an organization by ref', async () => {
      let ref = uniqueId('org');

      let created = await gateway.organization.upsert({ ref, name: 'First name' });
      expect(created).toMatchObject({
        object: 'ai_gateway#organization',
        ref,
        name: 'First name',
        archivedAt: null
      });

      let updated = await gateway.organization.upsert({ ref, name: 'Second name' });
      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Second name');
    });

    it('gets an organization by id', async () => {
      let organization = await gateway.organization.upsert({ ref: uniqueId('org') });

      let fetched = await gateway.organization.get({ organizationId: organization.id });
      expect(fetched.id).toBe(organization.id);
      expect(fetched.ref).toBe(organization.ref);
    });

    it('archives an organization', async () => {
      let organization = await gateway.organization.upsert({ ref: uniqueId('org') });

      let archived = await gateway.organization.archive({ organizationId: organization.id });
      expect(archived.archivedAt).toBeTruthy();
    });

    it('rejects an unknown organization', async () => {
      await expectServiceError(
        gateway.organization.get({ organizationId: 'does-not-exist' }),
        'not_found'
      );
    });
  });

  describe('projects', () => {
    it('upserts a project by ref within its organization', async () => {
      let organization = await gateway.organization.upsert({ ref: uniqueId('org') });
      let ref = uniqueId('project');

      let created = await gateway.project.upsert({
        organizationId: organization.id,
        ref,
        name: 'Initial'
      });
      expect(created).toMatchObject({
        object: 'ai_gateway#project',
        ref,
        organizationId: organization.id,
        platformLimits: [],
        disabled: null,
        billingRestriction: null
      });

      let again = await gateway.project.upsert({
        organizationId: organization.id,
        ref,
        name: 'Renamed'
      });
      expect(again.id).toBe(created.id);
      expect(again.name).toBe('Renamed');
    });

    it('refuses a ref that another organization already owns', async () => {
      let tenant = await createTenant();
      let other = await gateway.organization.upsert({ ref: uniqueId('org') });

      await expectServiceError(
        gateway.project.upsert({ organizationId: other.id, ref: tenant.project.ref }),
        'conflict'
      );
      await expectServiceError(
        gateway.instance.upsert({
          organizationId: other.id,
          projectId: (
            await gateway.project.upsert({
              organizationId: other.id,
              ref: uniqueId('project')
            })
          ).id,
          ref: tenant.instance.ref
        }),
        'conflict'
      );
    });

    it('does not expose a project through another organization', async () => {
      let tenant = await createTenant();
      let other = await gateway.organization.upsert({ ref: uniqueId('org') });

      await expectServiceError(
        gateway.project.get({ organizationId: other.id, projectId: tenant.project.id }),
        'not_found'
      );
    });

    it('archives a project', async () => {
      let tenant = await createTenant();

      let archived = await gateway.project.archive({
        organizationId: tenant.organization.id,
        projectId: tenant.project.id
      });
      expect(archived.archivedAt).toBeTruthy();
    });
  });

  describe('instances', () => {
    it('creates an instance with resolved default settings', async () => {
      let tenant = await createTenant();

      expect(tenant.instance).toMatchObject({
        object: 'ai_gateway#instance',
        organizationId: tenant.organization.id,
        project: { id: tenant.project.id, ref: tenant.project.ref },
        limits: [],
        settings: {
          contentLogging: { enabled: false, retentionDays: 7 },
          metorialProviderEnabled: true,
          fallbacksEnabled: true,
          zdrRequired: false
        }
      });
    });

    it('merges settings across upserts instead of replacing them', async () => {
      let tenant = await createTenant({
        settings: { contentLogging: { enabled: true, retentionDays: 30 } }
      });

      let updated = await gateway.instance.upsert({
        organizationId: tenant.organization.id,
        projectId: tenant.project.id,
        ref: tenant.instance.ref,
        settings: { metorialProvider: { enabled: false } }
      });

      expect(updated.id).toBe(tenant.instance.id);
      expect(updated.settings).toMatchObject({
        contentLogging: { enabled: true, retentionDays: 30 },
        metorialProviderEnabled: false
      });
    });

    it('stores limits and log retention', async () => {
      let limits = [{ metric: 'requests' as const, amount: 100, interval: '1h' as const }];
      let tenant = await createTenant({ limits, logRetentionDays: 14 });

      expect(tenant.instance.limits).toEqual(limits);
      expect(tenant.instance.logRetentionDays).toBe(14);
    });

    it('rejects settings that fail validation', async () => {
      let tenant = await createTenant();

      await expect(
        gateway.instance.upsert({
          organizationId: tenant.organization.id,
          projectId: tenant.project.id,
          ref: tenant.instance.ref,
          settings: { contentLogging: { retentionDays: 1000 } }
        })
      ).rejects.toThrow();
    });

    it('gets an instance only through its own organization', async () => {
      let tenant = await createTenant();
      let other = await gateway.organization.upsert({ ref: uniqueId('org') });

      let fetched = await gateway.instance.get({
        organizationId: tenant.organization.id,
        instanceId: tenant.instance.id
      });
      expect(fetched.id).toBe(tenant.instance.id);

      await expectServiceError(
        gateway.instance.get({ organizationId: other.id, instanceId: tenant.instance.id }),
        'not_found'
      );
    });

    it('lists the instances of a project', async () => {
      let tenant = await createTenant();
      let second = await gateway.instance.upsert({
        organizationId: tenant.organization.id,
        projectId: tenant.project.id,
        ref: uniqueId('instance')
      });

      let list = await gateway.instance.list({
        organizationId: tenant.organization.id,
        projectId: tenant.project.id
      });

      expect(list.items.map(instance => instance.id).sort()).toEqual(
        [tenant.instance.id, second.id].sort()
      );
    });

    it('archives an instance', async () => {
      let tenant = await createTenant();

      let archived = await gateway.instance.archive(tenant.scope);
      expect(archived.archivedAt).toBeTruthy();
    });
  });
});
