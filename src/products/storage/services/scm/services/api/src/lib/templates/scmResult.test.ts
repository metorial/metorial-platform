import { describe, expect, it } from 'vitest';
import { scmResultHtml } from './scmResult';

describe('SCM result page', () => {
  it('renders pending approval actions and escapes account data', () => {
    let html = scmResultHtml({
      kind: 'pending_approval',
      sessionId: 'osis_123',
      redirectUrl: 'https://platform.metorial.com/dashboard',
      accountName: '<script>alert(1)</script>',
      canRecheck: true
    });

    expect(html).toContain('Recheck approval');
    expect(html).toContain('Go back to dashboard');
    expect(html).toContain('/origin/scm/installation-session/osis_123/recheck');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('does not render unsafe redirect URLs', () => {
    let html = scmResultHtml({
      kind: 'succeeded',
      redirectUrl: 'javascript:alert(1)'
    });

    expect(html).toContain('Close window');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("postMessage({ type: 'scm_complete' }");
  });

  it('explains when automatic recheck is unavailable', () => {
    let html = scmResultHtml({
      kind: 'pending_approval',
      sessionId: 'osis_123',
      canRecheck: false
    });

    expect(html).toContain('could not identify the requested organization automatically');
    expect(html).toContain('disabled');
  });
});
