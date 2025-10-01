export let remoteServerTemplates = [
  {
    name: 'Linear',
    remoteUrl: 'https://mcp.linear.app/sse',
    type: 'oauth' as const
  },
  {
    name: 'Neon',
    remoteUrl: 'https://mcp.neon.tech/sse',
    type: 'oauth' as const
  },
  {
    name: 'Zapier',
    remoteUrl: 'https://mcp.zapier.com/api/mcp/mcp',
    type: 'oauth' as const
  },
  {
    name: 'Apify',
    remoteUrl: 'https://mcp.apify.com',
    type: 'oauth' as const
  },
  {
    name: 'monday.com',
    remoteUrl: 'https://mcp.monday.com/sse',
    type: 'oauth' as const
  },
  {
    name: 'Notion',
    remoteUrl: 'https://mcp.notion.com/sse',
    type: 'oauth' as const
  },
  {
    name: 'Prisma',
    remoteUrl: 'https://mcp.prisma.io/mcp',
    type: 'oauth' as const
  },
  {
    name: 'Sentry',
    remoteUrl: 'https://mcp.sentry.dev/sse',
    type: 'oauth' as const
  },
  {
    name: 'Cloudflare Workers',
    remoteUrl: 'https://bindings.mcp.cloudflare.com/sse',
    type: 'oauth' as const
  },
  {
    name: 'Square',
    remoteUrl: 'https://mcp.squareup.com/sse',
    type: 'oauth' as const
  },
  {
    name: 'Webflow',
    remoteUrl: 'https://mcp.webflow.com/sse',
    type: 'oauth' as const
  },
  {
    name: 'Wix',
    remoteUrl: 'https://mcp.wix.com/sse',
    type: 'oauth' as const
  },
  {
    name: 'Hugging Face',
    remoteUrl: 'https://hf.co/mcp',
    type: 'other' as const // Both oauth and unauthenticated access
  },
  {
    name: 'PayPal',
    remoteUrl: 'https://mcp.paypal.com/sse',
    type: 'oauth' as const
  },
  {
    name: 'Jam',
    remoteUrl: 'https://mcp.jam.dev/mcp',
    type: 'oauth' as const
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
  schema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    description: '',
    properties: {},
    required: []
  },
  getLaunchParams: `(config, ctx) => ({
  query: {},
  headers: ctx.getHeadersWithAuthorization({})
});`
};

export let defaultServerConfigManaged = {
  schema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    description: '',
    properties: {},
    required: []
  },
  getLaunchParams: `(config, ctx) => ({
  args: {
    // Get access to oauth token (if oauth is configured)
    token: config.oauthToken,

    ...config
  }
});`
};
