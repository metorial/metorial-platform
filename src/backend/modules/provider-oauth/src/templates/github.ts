import { providerOauthTemplateService } from '../services';

providerOauthTemplateService.ensureTemplate({
  slug: 'github',
  name: 'GitHub',
  providerName: 'GitHub',
  providerUrl: 'https://www.github.com',

  imageUrl: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/providers/github.svg',

  variables: [],

  configJsonata: JSON.stringify(
    {
      issuer: 'https://github.com',
      authorization_endpoint: 'https://github.com/login/oauth/authorize',
      token_endpoint: 'https://github.com/login/oauth/access_token',
      userinfo_endpoint: 'https://api.github.com/user',
      scopes_supported: [
        'repo',
        'read:org',
        'user',
        'gist',
        'notifications',
        'workflow',
        'admin:org'
      ],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['client_secret_basic'],
      service_documentation: 'https://docs.github.com/en/apps/oauth-apps'
    },
    null,
    2
  ),

  scopes: [
    {
      identifier: 'repo',
      description: 'Grants full control of private repositories'
    },
    {
      identifier: 'read:org',
      description: 'Grants read-only access to organization, teams, and membership'
    },
    {
      identifier: 'user',
      description: 'Grants read/write access to profile info only'
    },
    {
      identifier: 'gist',
      description: 'Grants write access to gists'
    },
    {
      identifier: 'notifications',
      description: 'Grants read access to notifications'
    },
    {
      identifier: 'workflow',
      description: 'Grants access to manage workflows'
    },
    {
      identifier: 'admin:org',
      description:
        'Grants full control of orgs and teams, read/write access to hooks and projects'
    }
  ]
});
