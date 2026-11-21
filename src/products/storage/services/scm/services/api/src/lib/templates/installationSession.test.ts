import { describe, expect, it } from 'vitest';
import { installationSessionHtml } from './installationSession';

describe('installationSessionHtml', () => {
  it('renders provider names and descriptions as text', () => {
    let html = installationSessionHtml({
      sessionId: 'ses_1',
      backends: [
        {
          id: 'bck_1',
          type: 'gitlab_selfhosted',
          name: '"><img src=x onerror=alert(1)>',
          description: '<script>alert(2)</script>',
          isDefault: false
        }
      ]
    });

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('keeps ordinary provider names readable', () => {
    let html = installationSessionHtml({
      sessionId: 'ses_1',
      backends: [
        { id: 'bck_1', type: 'github', name: 'GitHub', description: null, isDefault: true }
      ]
    });

    expect(html).toContain('GitHub');
    expect(html).toContain('<span class="backend-badge">Default</span>');
  });
});
