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
      endpoint: 'https://http-inputs.customer.splunkcloud.com/services/collector',
      token: 'splunk-secret',
      index: 'audit',
      source: 'metorial',
      sourcetype: '_json'
    });

    expect(data).toEqual({
      endpoint: 'https://http-inputs.customer.splunkcloud.com/services/collector',
      token: 'splunk-secret',
      index: 'audit',
      source: 'metorial',
      sourcetype: '_json'
    });
    expect(sanitizeAuditLogStreamProviderData('splunk', data)).toEqual({
      endpoint: 'https://http-inputs.customer.splunkcloud.com/services/collector',
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

  it('allows vendor sites without hard-coding regions', () => {
    expect(() =>
      validateAuditLogStreamProviderData('datadog', {
        apiKey: 'secret',
        site: 'future-region.datadoghq.com'
      })
    ).not.toThrow();
    expect(() =>
      validateAuditLogStreamProviderData('datadog', {
        apiKey: 'secret',
        site: 'future-region.ddog-gov.com'
      })
    ).not.toThrow();
    expect(() =>
      validateAuditLogStreamProviderData('splunk', {
        endpoint: 'https://http-inputs.future-region.splunkcloud.com/services/collector',
        token: 'secret'
      })
    ).not.toThrow();
  });

  it('rejects destination URLs that can target non-vendor hosts', () => {
    let invalidDatadogSites = [
      'localhost',
      'datadoghq.com.attacker.example',
      'attacker.example/datadoghq.com'
    ];
    let invalidSplunkEndpoints = [
      'http://customer.splunkcloud.com/services/collector',
      'https://splunkcloud.com@attacker.example/services/collector',
      'https://customer.splunkcloud.com.attacker.example/services/collector',
      'https://127.0.0.1/services/collector'
    ];

    for (let site of invalidDatadogSites) {
      expect(() =>
        validateAuditLogStreamProviderData('datadog', { apiKey: 'secret', site })
      ).toThrow();
    }

    for (let endpoint of invalidSplunkEndpoints) {
      expect(() =>
        validateAuditLogStreamProviderData('splunk', { endpoint, token: 'secret' })
      ).toThrow();
    }
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
