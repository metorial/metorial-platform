import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  auditLogStreamDestinations,
  deliverAuditLogStreamEvents,
  sanitizeAuditLogStreamProviderData,
  validateAuditLogStreamProviderData
} from '.';

describe('audit log stream destinations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers every supported destination', () => {
    expect(Object.keys(auditLogStreamDestinations)).toEqual(['datadog', 'splunk']);
  });

  it('validates and sanitizes Datadog configuration', () => {
    let data = validateAuditLogStreamProviderData('datadog', {
      apiKey: 'dd-secret',
      site: 'datadoghq.eu'
    });

    expect(data).toEqual({ apiKey: 'dd-secret', site: 'datadoghq.eu' });
    expect(sanitizeAuditLogStreamProviderData('datadog', data)).toEqual({
      site: 'datadoghq.eu'
    });
  });

  it('validates and sanitizes Splunk configuration', () => {
    let data = validateAuditLogStreamProviderData('splunk', {
      endpoint: 'https://splunk.example.com/services/collector',
      token: 'splunk-secret',
      index: 'audit',
      source: 'metorial',
      sourcetype: '_json'
    });

    expect(data).toEqual({
      endpoint: 'https://splunk.example.com/services/collector',
      token: 'splunk-secret',
      index: 'audit',
      source: 'metorial',
      sourcetype: '_json'
    });
    expect(sanitizeAuditLogStreamProviderData('splunk', data)).toEqual({
      endpoint: 'https://splunk.example.com/services/collector',
      index: 'audit',
      source: 'metorial',
      sourcetype: '_json'
    });
  });

  it('rejects malformed destination configuration', () => {
    expect(() =>
      validateAuditLogStreamProviderData('datadog', {
        apiKey: 'secret',
        site: 'datadoghq.com@attacker.example'
      })
    ).toThrow();
    expect(() =>
      validateAuditLogStreamProviderData('splunk', {
        endpoint: 'not-a-url',
        token: 'secret'
      })
    ).toThrow();
  });

  it('dispatches delivery with provider-specific configuration', async () => {
    let deliver = vi.spyOn(auditLogStreamDestinations.datadog, 'deliver').mockResolvedValue();

    await deliverAuditLogStreamEvents({
      provider: 'datadog',
      providerData: {
        apiKey: 'dd-secret',
        site: 'datadoghq.eu'
      },
      events: []
    });

    expect(deliver).toHaveBeenCalledWith({
      providerData: {
        apiKey: 'dd-secret',
        site: 'datadoghq.eu'
      },
      events: []
    });
  });
});
