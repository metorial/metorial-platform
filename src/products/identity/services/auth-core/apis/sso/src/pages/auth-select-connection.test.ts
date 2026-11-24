import { expect, it } from 'vitest';
import { authSelectConnectionHtml } from './auth-select-connection';

it('renders a native connection selector with encoded text and values', () => {
  let html = authSelectConnectionHtml({
    tenant: { name: 'Tenant <North>' },
    connections: [
      {
        id: 'co"1',
        name: 'Research & Design',
        providerType: 'saml',
        providerName: 'IdP <EU>'
      },
      { id: 'co_2', name: 'Engineering', providerType: 'oidc', providerName: null }
    ],
    clientSecret: 'start"1'
  });

  expect(html).toContain('<form class="connections-list" method="get">');
  expect(html).toContain('name="client_secret" value="start&quot;1"');
  expect(html).toContain('name="connection_id" value="co&quot;1"');
  expect(html).toContain('Tenant &lt;North&gt;');
  expect(html).toContain('Research &amp; Design');
  expect(html).toContain('IdP &lt;EU&gt;');
  expect(html).not.toMatch(/<script|onclick=/);
});
