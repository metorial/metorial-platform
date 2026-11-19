import { describe, expect, it } from 'vitest';
import { getProviderWebUrl } from './providerWebUrl';

describe('getProviderWebUrl', () => {
  it('keeps HTTP and HTTPS repository URLs unchanged', () => {
    expect(getProviderWebUrl('https://github.com/acme/widgets')).toBe(
      'https://github.com/acme/widgets'
    );
    expect(getProviderWebUrl('http://git.internal.example/acme/widgets')).toBe(
      'http://git.internal.example/acme/widgets'
    );
  });

  it('rejects anything that is not an HTTP or HTTPS URL', () => {
    for (let value of [
      'javascript:alert(1)',
      ' javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/hosts',
      '/acme/widgets',
      '',
      undefined,
      null,
      { href: 'https://github.com/acme/widgets' }
    ]) {
      expect(() => getProviderWebUrl(value)).toThrow('invalid repository URL');
    }
  });
});
