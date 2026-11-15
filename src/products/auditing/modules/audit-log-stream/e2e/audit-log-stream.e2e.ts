import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  auditLogStreamEventService,
  auditLogStreamService,
  decryptAuditLogStreamProviderData
} from '../src';

describe('module-audit-log-stream', () => {
  let org = useOrganization();

  it('creates, toggles and deletes an audit log stream with encrypted provider data', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let apiKey = uniqueId('dd-key');
    let site = 'e2e.datadoghq.com';

    let stream = await auditLogStreamService.createAuditLogStream({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { provider: 'datadog', providerData: { apiKey, site } }
    });

    let disabled = await auditLogStreamService.updateAuditLogStream({
      organization: fixture.organization,
      auditLogStream: stream,
      auditScope: fixture.auditScope,
      input: { status: 'inactive' }
    });

    try {
      expect(stream).toMatchObject({
        provider: 'datadog',
        status: 'active',
        accessStatus: 'ok'
      });
      expect(stream.providerDataRedacted).toEqual({ site });
      expect(stream.encryptedProviderData).not.toContain(apiKey);
      expect(disabled.status).toBe('inactive');

      let decrypted = await decryptAuditLogStreamProviderData({
        streamId: stream.id,
        provider: 'datadog',
        encryptedProviderData: disabled.encryptedProviderData
      });
      expect(decrypted).toEqual({ apiKey, site });

      let streams = await firstPage(
        await auditLogStreamService.listAuditLogStreams({ organization: fixture.organization })
      );
      expect(streams.map(item => item.id)).toContain(stream.id);

      let enabled = await auditLogStreamService.updateAuditLogStream({
        organization: fixture.organization,
        auditLogStream: disabled,
        auditScope: fixture.auditScope,
        input: { status: 'active' }
      });
      disabled = await auditLogStreamService.updateAuditLogStream({
        organization: fixture.organization,
        auditLogStream: enabled,
        auditScope: fixture.auditScope,
        input: { status: 'inactive' }
      });

      let events = await firstPage(
        await auditLogStreamEventService.listAuditLogStreamEvents({ auditLogStream: disabled })
      );
      let lifecycleTypes = events
        .map(event => event.type)
        .filter(type => type == 'created' || type == 'enabled' || type == 'disabled')
        .sort();
      expect(lifecycleTypes).toEqual(['created', 'disabled', 'disabled', 'enabled']);

      await expect(
        auditLogStreamService.resumeAuditLogStream({
          organization: fixture.organization,
          auditLogStream: disabled,
          auditScope: fixture.auditScope
        })
      ).rejects.toThrow();
    } finally {
      await auditLogStreamService.deleteAuditLogStream({
        organization: fixture.organization,
        auditLogStream: disabled,
        auditScope: fixture.auditScope
      });
    }

    let remaining = await firstPage(
      await auditLogStreamService.listAuditLogStreams({ organization: fixture.organization })
    );
    expect(remaining.map(item => item.id)).not.toContain(stream.id);
  });

  it('rejects invalid provider data', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    await expect(
      auditLogStreamService.createAuditLogStream({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          provider: 'datadog',
          providerData: { apiKey: uniqueId('dd-key'), site: 'example.com' }
        }
      })
    ).rejects.toThrow();

    await expect(
      auditLogStreamService.createAuditLogStream({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          provider: 'splunk',
          providerData: { endpoint: 'http://splunk.internal/services/collector', token: 'x' }
        }
      })
    ).rejects.toThrow();
  });
});
