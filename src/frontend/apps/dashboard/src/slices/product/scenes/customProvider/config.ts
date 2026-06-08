import { JSONSchema7 } from 'json-schema';

let createEmptySchema = (): JSONSchema7 => ({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description: '',
  properties: {},
  required: []
});

export let remoteServerTemplates = [
  {
    name: 'Linear',
    remoteUrl: 'https://mcp.linear.app/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Neon',
    remoteUrl: 'https://mcp.neon.tech/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Apify',
    remoteUrl: 'https://mcp.apify.com',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'monday.com',
    remoteUrl: 'https://mcp.monday.com/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Notion',
    remoteUrl: 'https://mcp.notion.com/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Prisma',
    remoteUrl: 'https://mcp.prisma.io/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Sentry',
    remoteUrl: 'https://mcp.sentry.dev/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Cloudflare Workers',
    remoteUrl: 'https://bindings.mcp.cloudflare.com/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Square',
    remoteUrl: 'https://mcp.squareup.com/mcp',
    type: 'oauth' as const,
    protocol: 'streamable_http' as const
  },
  {
    name: 'Webflow',
    remoteUrl: 'https://mcp.webflow.com/sse',
    type: 'oauth' as const,
    protocol: 'sse' as const
  },
  {
    name: 'PayPal',
    remoteUrl: 'https://mcp.paypal.com/sse',
    type: 'oauth' as const,
    protocol: 'sse' as const
  },
  {
    name: 'Jam',
    remoteUrl: 'https://mcp.jam.dev/mcp',
    type: 'oauth' as const,
    protocol: 'sse' as const
  }
].map(t => {
  let url = new URL(t.remoteUrl);
  let rootHost = url.hostname.split('.').slice(-2).join('.');
  let rootOrigin = `${url.protocol}//${rootHost}`;

  return {
    ...t,
    imageUrl: `https://camo-cdn.metorial.com/pub?url=${encodeURIComponent(`https://logos.metorial.com/?url=${encodeURIComponent(rootOrigin)}`)}`
  };
});

export type ManagedServerTemplateFile = {
  filename: string;
  content: string;
};

export type ManagedServerTemplate = {
  id: string;
  slug: string;
  name: string;
  category: 'Basic' | 'API' | 'OAuth' | 'Productivity' | 'Developer';
  description: string;
  imageUrl?: string;
  icon?: 'tools' | 'http' | 'config' | 'oauth';
  files: ManagedServerTemplateFile[];
};

let packageJson = (name: string): ManagedServerTemplateFile => ({
  filename: 'package.json',
  content: `${JSON.stringify(
    {
      name,
      private: true,
      type: 'module',
      version: '1.0.0',
      main: 'index.ts',
      dependencies: {
        '@metorial/mcp': 'latest',
        '@metorial/mcp-server': 'latest',
        zod: 'latest'
      }
    },
    null,
    2
  )}\n`
});

let templateFiles = (name: string, indexTs: string): ManagedServerTemplateFile[] => [
  {
    filename: 'index.ts',
    content: indexTs.trimStart()
  },
  packageJson(name)
];

export let managedServerTemplates: ManagedServerTemplate[] = [
  {
    id: 'basic-tools',
    slug: 'basic-tools',
    name: 'Basic Tools',
    category: 'Basic',
    description: 'Simple tools with typed inputs and outputs.',
    icon: 'tools',
    files: templateFiles(
      'basic-tools-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createMcpServer } from '@metorial/mcp-server';
import z from 'zod';

let add = McpTool.create('add', {
  description: 'Add two numbers.'
})
  .input(
    z.object({
      a: z.number(),
      b: z.number()
    })
  )
  .output(
    z.object({
      result: z.number()
    })
  )
  .handle(async input => ({ result: input.a + input.b }));

let stringify = McpTool.create('stringify', {
  description: 'Format any JSON value as a string.'
})
  .input(
    z.object({
      data: z.any()
    })
  )
  .output(
    z.object({
      result: z.string()
    })
  )
  .handle(async input => ({ result: JSON.stringify(input.data, null, 2) }));

let timestamp = McpTool.create('timestamp', {
  description: 'Return the current ISO timestamp.'
})
  .output(
    z.object({
      now: z.string()
    })
  )
  .handle(async () => ({ now: new Date().toISOString() }));

export let server = createMcpServer({
  name: 'Basic Tools',
  version: '1.0.0',
  tools: [add, stringify, timestamp]
});

export default server;
`
    )
  },
  {
    id: 'http-api-client',
    slug: 'http-api-client',
    name: 'HTTP API Client',
    category: 'API',
    description: 'Connect to any JSON REST API over HTTP.',
    icon: 'http',
    files: templateFiles(
      'http-api-client-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    baseUrl: z.string().url(),
    apiKey: z.string().optional(),
    authorizationHeader: z.string().optional()
  })
);

let headers = () => {
  let h: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  if (config.apiKey) {
    h[config.authorizationHeader || 'Authorization'] = config.apiKey;
  }

  return h;
};

let apiUrl = (path: string) => new URL(path, config.baseUrl).toString();

let getJson = McpTool.create('getJson', {
  description: 'Send a GET request and return JSON.'
})
  .input(
    z.object({
      path: z.string()
    })
  )
  .output(z.object({ data: z.any() }))
  .handle(async input => {
    let res = await fetch(apiUrl(input.path), { headers: headers() });
    if (!res.ok) throw new Error('GET request failed: ' + res.statusText);
    return { data: await res.json() };
  });

let postJson = McpTool.create('postJson', {
  description: 'Send a POST request with a JSON body.'
})
  .input(
    z.object({
      path: z.string(),
      body: z.any()
    })
  )
  .output(z.object({ data: z.any() }))
  .handle(async input => {
    let res = await fetch(apiUrl(input.path), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(input.body)
    });
    if (!res.ok) throw new Error('POST request failed: ' + res.statusText);
    return { data: await res.json() };
  });

let healthCheck = McpTool.create('healthCheck', {
  description: 'Check whether the configured API is reachable.'
})
  .output(z.object({ ok: z.boolean(), status: z.number() }))
  .handle(async () => {
    let res = await fetch(apiUrl('/'), { headers: headers() });
    return { ok: res.ok, status: res.status };
  });

export let server = createMcpServer({
  name: 'HTTP API Client',
  version: '1.0.0',
  tools: [getJson, postJson, healthCheck],
  config
});

export default server;
`
    )
  },
  {
    id: 'config-basics',
    slug: 'config-basics',
    name: 'Config Basics',
    category: 'Basic',
    description: 'Read custom config values from tools.',
    icon: 'config',
    files: templateFiles(
      'config-basics-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    workspaceName: z.string(),
    defaultLimit: z.number(),
    enabledFeatures: z.array(z.string())
  })
);

let showConfig = McpTool.create('showConfig')
  .output(
    z.object({
      workspaceName: z.string(),
      defaultLimit: z.number(),
      enabledFeatures: z.array(z.string())
    })
  )
  .handle(async () => ({
    workspaceName: config.workspaceName,
    defaultLimit: config.defaultLimit,
    enabledFeatures: config.enabledFeatures
  }));

let featureEnabled = McpTool.create('featureEnabled')
  .input(z.object({ feature: z.string() }))
  .output(z.object({ enabled: z.boolean() }))
  .handle(async input => ({
    enabled: config.enabledFeatures.includes(input.feature)
  }));

let formatGreeting = McpTool.create('formatGreeting')
  .input(z.object({ name: z.string() }))
  .output(z.object({ message: z.string() }))
  .handle(async input => ({
    message: 'Hello ' + input.name + ' from ' + config.workspaceName + '.'
  }));

export let server = createMcpServer({
  name: 'Config Basics',
  version: '1.0.0',
  tools: [showConfig, featureEnabled, formatGreeting],
  config
});

export default server;
`
    )
  },
  {
    id: 'oauth-basics',
    slug: 'oauth-basics',
    name: 'OAuth Basics',
    category: 'OAuth',
    description: 'A minimal OAuth 2.0 HTTP API template.',
    icon: 'oauth',
    files: templateFiles(
      'oauth-basics-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer, createOAuth } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    apiBaseUrl: z.string().url()
  })
);

let authConfig = createOAuth(
  z.object({
    authorizationUrl: z.string().url(),
    tokenUrl: z.string().url(),
    scope: z.string()
  }),
  {
    getAuthorizationUrl: async ctx => {
      let url = new URL(ctx.authConfig.authorizationUrl);
      url.searchParams.set('client_id', ctx.clientId);
      url.searchParams.set('redirect_uri', ctx.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', ctx.authConfig.scope);
      url.searchParams.set('state', ctx.state);
      return url.toString();
    },
    handleCallback: async ctx => {
      let res = await fetch(ctx.authConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: ctx.code,
          client_id: ctx.clientId,
          client_secret: ctx.clientSecret,
          redirect_uri: ctx.redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!res.ok) throw new Error('Token exchange failed: ' + res.statusText);
      let data = await res.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope,
        tokenType: data.token_type
      };
    }
  }
);

let getProfile = McpTool.create('getProfile')
  .output(z.object({ data: z.any() }))
  .handle(async () => {
    let res = await fetch(new URL('/me', config.apiBaseUrl), {
      headers: { Authorization: 'Bearer ' + authConfig.accessToken }
    });
    if (!res.ok) throw new Error('Profile request failed: ' + res.statusText);
    return { data: await res.json() };
  });

let getTokenInfo = McpTool.create('getTokenInfo')
  .output(
    z.object({
      tokenType: z.string().optional(),
      scope: z.string().optional(),
      expiresIn: z.number().optional()
    })
  )
  .handle(async () => ({
    tokenType: authConfig.tokenType,
    scope: authConfig.scope,
    expiresIn: authConfig.expiresIn
  }));

export let server = createMcpServer({
  name: 'OAuth Basics',
  version: '1.0.0',
  tools: [getProfile, getTokenInfo],
  config,
  authConfig
});

export default server;
`
    )
  },
  {
    id: 'slack-workspace',
    slug: 'slack-workspace',
    name: 'Slack',
    category: 'Productivity',
    description: 'List channels, post messages, and search Slack.',
    imageUrl: 'https://provider-logos.metorial-cdn.com/slack.svg',
    files: templateFiles(
      'slack-workspace-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer, createOAuth } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    defaultChannelId: z.string().optional()
  })
);

let authConfig = createOAuth({
  getAuthorizationUrl: async ctx => {
    let url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', ctx.clientId);
    url.searchParams.set('redirect_uri', ctx.redirectUri);
    url.searchParams.set('state', ctx.state);
    url.searchParams.set('scope', 'channels:read chat:write search:read');
    return url.toString();
  },
  handleCallback: async ctx => {
    let res = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: ctx.code,
        client_id: ctx.clientId,
        client_secret: ctx.clientSecret,
        redirect_uri: ctx.redirectUri
      })
    });
    let data = await res.json();
    if (!res.ok || !data.ok) throw new Error('Slack OAuth failed: ' + (data.error || res.statusText));
    return {
      accessToken: data.access_token,
      scope: data.scope,
      tokenType: data.token_type
    };
  }
});

let slackFetch = async (path: string, init: RequestInit = {}) => {
  let res = await fetch('https://slack.com/api/' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + authConfig.accessToken,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  let data = await res.json();
  if (!res.ok || data.ok === false) throw new Error('Slack API failed: ' + (data.error || res.statusText));
  return data;
};

let listChannels = McpTool.create('listChannels')
  .output(z.object({ channels: z.any() }))
  .handle(async () => ({
    channels: (await slackFetch('conversations.list?types=public_channel,private_channel')).channels
  }));

let postMessage = McpTool.create('postMessage')
  .input(z.object({ channelId: z.string().optional(), text: z.string() }))
  .output(z.object({ ok: z.boolean(), ts: z.string().optional() }))
  .handle(async input => {
    let data = await slackFetch('chat.postMessage', {
      method: 'POST',
      body: JSON.stringify({
        channel: input.channelId || config.defaultChannelId,
        text: input.text
      })
    });
    return { ok: true, ts: data.ts };
  });

let searchMessages = McpTool.create('searchMessages')
  .input(z.object({ query: z.string() }))
  .output(z.object({ messages: z.any() }))
  .handle(async input => ({
    messages: (await slackFetch('search.messages?query=' + encodeURIComponent(input.query))).messages
  }));

export let server = createMcpServer({
  name: 'Slack Workspace',
  version: '1.0.0',
  tools: [listChannels, postMessage, searchMessages],
  config,
  authConfig
});

export default server;
`
    )
  },
  {
    id: 'gmail-assistant',
    slug: 'gmail-assistant',
    name: 'Gmail',
    category: 'Productivity',
    description: 'Search Gmail and create drafts.',
    imageUrl: 'https://provider-logos.metorial-cdn.com/gmail.svg',
    files: templateFiles(
      'gmail-assistant-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer, createOAuth } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    defaultFrom: z.string().email().optional(),
    labelIds: z.array(z.string()).optional()
  })
);

let authConfig = createOAuth({
  getAuthorizationUrl: async ctx => {
    let url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', ctx.clientId);
    url.searchParams.set('redirect_uri', ctx.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', ctx.state);
    url.searchParams.set('scope', [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose'
    ].join(' '));
    return url.toString();
  },
  handleCallback: async ctx => {
    let res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: ctx.code,
        client_id: ctx.clientId,
        client_secret: ctx.clientSecret,
        redirect_uri: ctx.redirectUri,
        grant_type: 'authorization_code'
      })
    });
    if (!res.ok) throw new Error('Google token exchange failed: ' + res.statusText);
    let data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
      tokenType: data.token_type
    };
  }
});

let gmailFetch = async (path: string, init: RequestInit = {}) => {
  let res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + authConfig.accessToken,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) throw new Error('Gmail API failed: ' + res.statusText);
  return res.json();
};

let encodeBase64Url = (value: string) =>
  Buffer.from(value).toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');

let searchMessages = McpTool.create('searchMessages')
  .input(z.object({ query: z.string(), maxResults: z.number().optional() }))
  .output(z.object({ messages: z.any() }))
  .handle(async input => ({
    messages: (await gmailFetch('messages?' + new URLSearchParams({
      q: input.query,
      maxResults: String(input.maxResults || 10)
    }))).messages || []
  }));

let getMessage = McpTool.create('getMessage')
  .input(z.object({ messageId: z.string() }))
  .output(z.object({ message: z.any() }))
  .handle(async input => ({
    message: await gmailFetch('messages/' + input.messageId + '?format=full')
  }));

let createDraft = McpTool.create('createDraft')
  .input(z.object({ to: z.string().email(), subject: z.string(), body: z.string() }))
  .output(z.object({ draft: z.any() }))
  .handle(async input => {
    let from = config.defaultFrom ? 'From: ' + config.defaultFrom + '\\n' : '';
    let raw = encodeBase64Url(from + 'To: ' + input.to + '\\nSubject: ' + input.subject + '\\n\\n' + input.body);
    return {
      draft: await gmailFetch('drafts', {
        method: 'POST',
        body: JSON.stringify({ message: { raw } })
      })
    };
  });

export let server = createMcpServer({
  name: 'Gmail Assistant',
  version: '1.0.0',
  tools: [searchMessages, getMessage, createDraft],
  config,
  authConfig
});

export default server;
`
    )
  },
  {
    id: 'github-issues',
    slug: 'github-issues',
    name: 'GitHub',
    category: 'Developer',
    description: 'List, create, and comment on GitHub issues.',
    imageUrl: 'https://provider-logos.metorial-cdn.com/github.png',
    files: templateFiles(
      'github-issues-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    owner: z.string(),
    repo: z.string(),
    apiToken: z.string()
  })
);

let githubFetch = async (path: string, init: RequestInit = {}) => {
  let res = await fetch('https://api.github.com/repos/' + config.owner + '/' + config.repo + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + config.apiToken,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) throw new Error('GitHub API failed: ' + res.statusText);
  return res.json();
};

let listIssues = McpTool.create('listIssues')
  .input(z.object({ state: z.enum(['open', 'closed', 'all']).optional() }))
  .output(z.object({ issues: z.any() }))
  .handle(async input => ({
    issues: await githubFetch('/issues?state=' + (input.state || 'open'))
  }));

let createIssue = McpTool.create('createIssue')
  .input(z.object({ title: z.string(), body: z.string().optional() }))
  .output(z.object({ issue: z.any() }))
  .handle(async input => ({
    issue: await githubFetch('/issues', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }));

let commentOnIssue = McpTool.create('commentOnIssue')
  .input(z.object({ issueNumber: z.number(), body: z.string() }))
  .output(z.object({ comment: z.any() }))
  .handle(async input => ({
    comment: await githubFetch('/issues/' + input.issueNumber + '/comments', {
      method: 'POST',
      body: JSON.stringify({ body: input.body })
    })
  }));

export let server = createMcpServer({
  name: 'GitHub Issues',
  version: '1.0.0',
  tools: [listIssues, createIssue, commentOnIssue],
  config
});

export default server;
`
    )
  },
  {
    id: 'notion-database',
    slug: 'notion-database',
    name: 'Notion',
    category: 'Productivity',
    description: 'Query databases and create pages in Notion.',
    imageUrl: 'https://provider-logos.metorial-cdn.com/notion.svg',
    files: templateFiles(
      'notion-database-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    databaseId: z.string(),
    integrationToken: z.string()
  })
);

let notionFetch = async (path: string, init: RequestInit = {}) => {
  let res = await fetch('https://api.notion.com/v1/' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + config.integrationToken,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
      ...(init.headers || {})
    }
  });
  if (!res.ok) throw new Error('Notion API failed: ' + res.statusText);
  return res.json();
};

let queryDatabase = McpTool.create('queryDatabase')
  .input(z.object({ filter: z.any().optional() }))
  .output(z.object({ results: z.any() }))
  .handle(async input => ({
    results: (await notionFetch('databases/' + config.databaseId + '/query', {
      method: 'POST',
      body: JSON.stringify({ filter: input.filter })
    })).results
  }));

let createPage = McpTool.create('createPage')
  .input(z.object({ title: z.string() }))
  .output(z.object({ page: z.any() }))
  .handle(async input => ({
    page: await notionFetch('pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: config.databaseId },
        properties: {
          Name: {
            title: [{ text: { content: input.title } }]
          }
        }
      })
    })
  }));

let appendBlock = McpTool.create('appendBlock')
  .input(z.object({ pageId: z.string(), text: z.string() }))
  .output(z.object({ block: z.any() }))
  .handle(async input => ({
    block: await notionFetch('blocks/' + input.pageId + '/children', {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: input.text } }]
            }
          }
        ]
      })
    })
  }));

export let server = createMcpServer({
  name: 'Notion Database',
  version: '1.0.0',
  tools: [queryDatabase, createPage, appendBlock],
  config
});

export default server;
`
    )
  },
  {
    id: 'linear-project-helper',
    slug: 'linear-project-helper',
    name: 'Linear',
    category: 'Productivity',
    description: 'Manage Linear issues with GraphQL.',
    imageUrl: 'https://provider-logos.metorial-cdn.com/linear.png',
    files: templateFiles(
      'linear-project-helper-mcp-server',
      `
import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    apiKey: z.string(),
    teamId: z.string().optional()
  })
);

let linearGraphql = async (query: string, variables: Record<string, any> = {}) => {
  let res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: config.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  let data = await res.json();
  if (!res.ok || data.errors) throw new Error('Linear API failed: ' + JSON.stringify(data.errors || data));
  return data.data;
};

let listIssues = McpTool.create('listIssues')
  .input(z.object({ query: z.string().optional() }))
  .output(z.object({ issues: z.any() }))
  .handle(async input => ({
    issues: (await linearGraphql(
      'query Issues($query: String) { issues(filter: { title: { containsIgnoreCase: $query } }, first: 20) { nodes { id identifier title state { name } url } } }',
      { query: input.query || '' }
    )).issues.nodes
  }));

let createIssue = McpTool.create('createIssue')
  .input(z.object({ title: z.string(), description: z.string().optional(), teamId: z.string().optional() }))
  .output(z.object({ issue: z.any() }))
  .handle(async input => ({
    issue: (await linearGraphql(
      'mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { issue { id identifier title url } } }',
      { input: { title: input.title, description: input.description, teamId: input.teamId || config.teamId } }
    )).issueCreate.issue
  }));

let updateIssueStatus = McpTool.create('updateIssueStatus')
  .input(z.object({ issueId: z.string(), stateId: z.string() }))
  .output(z.object({ issue: z.any() }))
  .handle(async input => ({
    issue: (await linearGraphql(
      'mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { issue { id identifier title state { name } url } } }',
      { id: input.issueId, input: { stateId: input.stateId } }
    )).issueUpdate.issue
  }));

export let server = createMcpServer({
  name: 'Linear Project Helper',
  version: '1.0.0',
  tools: [listIssues, createIssue, updateIssueStatus],
  config
});

export default server;
`
    )
  }
];

export let getManagedServerTemplateFiles = (template: ManagedServerTemplate) =>
  template.files.map(file => ({ ...file }));

export let defaultServerConfigRemote = {
  schema: createEmptySchema(),
  getLaunchParams: `(config, ctx) => ({
  query: {},
  headers: ctx.getHeadersWithAuthorization({})
});`
};

export let defaultServerConfigManaged = {
  schema: createEmptySchema(),
  getLaunchParams: `(config, ctx) => ({
  args: {
    // Get access to oauth token (if oauth is configured)
    token: config.oauthToken,

    ...config
  }
});`
};

export let getDefaultServerConfigDocker = {
  schema: createEmptySchema(),
  getLaunchParams: `(config, ctx) => ({
  command: 'npm',
  args: ['run', 'start'],
  env: {}
});`
};
