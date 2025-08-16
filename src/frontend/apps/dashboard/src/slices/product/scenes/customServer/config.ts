export let remoteServerTemplates = [
  {
    name: 'Linear',
    remoteUrl: 'https://mcp.linear.app/sse'
  },
  {
    name: 'Neon',
    remoteUrl: 'https://mcp.neon.tech/sse'
  },
  {
    name: 'Zapier',
    remoteUrl: 'https://mcp.zapier.com/api/mcp/mcp'
  },
  {
    name: 'Apify',
    remoteUrl: 'https://mcp.apify.com'
  },
  {
    name: 'monday.com',
    remoteUrl: 'https://mcp.monday.com/sse'
  },
  {
    name: 'Notion',
    remoteUrl: 'https://mcp.notion.com/sse'
  },
  {
    name: 'Prisma',
    remoteUrl: 'https://mcp.prisma.io/mcp'
  },
  {
    name: 'Sentry',
    remoteUrl: 'https://mcp.sentry.dev/sse'
  },
  {
    name: 'Cloudflare Workers',
    remoteUrl: 'https://bindings.mcp.cloudflare.com/sse'
  },
  {
    name: 'Square',
    remoteUrl: 'https://mcp.squareup.com/sse'
  },
  {
    name: 'Webflow',
    remoteUrl: 'https://mcp.webflow.com/sse'
  },
  {
    name: 'Wix',
    remoteUrl: 'https://mcp.wix.com/sse'
  },
  {
    name: 'Hugging Face',
    remoteUrl: 'https://hf.co/mcp'
  },
  {
    name: 'PayPal',
    remoteUrl: 'https://mcp.paypal.com/sse'
  },
  {
    name: 'Jam',
    remoteUrl: 'https://mcp.jam.dev/mcp'
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
