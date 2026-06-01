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
