import { describe, expect, it } from 'vitest';
import {
  sanitizeAuditLogStreamProviderData,
  validateAuditLogStreamProviderData
} from './providers';

describe('audit log stream providers', () => {
  it('validates Datadog configuration', () => {
    let data = validateAuditLogStreamProviderData('datadog', {
      apiKey: 'dd-secret',
      site: 'datadoghq.eu'
    });

    expect(data).toEqual({ apiKey: 'dd-secret', site: 'datadoghq.eu' });
    expect(sanitizeAuditLogStreamProviderData('datadog', data)).toEqual({
      site: 'datadoghq.eu'
    });
  });

  it('validates Splunk configuration', () => {
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

  it('rejects malformed provider configuration', () => {
    expect(() =>
      validateAuditLogStreamProviderData('datadog', {
        site: 'datadoghq.com'
      })
    ).toThrow();
    expect(() =>
      validateAuditLogStreamProviderData('splunk', {
        endpoint: 'not-a-url',
        token: 'secret'
      })
    ).toThrow();
  });
});
