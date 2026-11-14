import { McpTool } from '@metorial/mcp';
import { createConfig, createMcpServer, createOAuth } from '@metorial/mcp-server';
import z from 'zod';

let config = createConfig(
  z.object({
    abc: z.string(),
    xyz: z.number()
  })
);

let authConfig = createOAuth({
  getAuthorizationUrl: async ctx => {
    // Google OAuth 2.0 endpoint for requesting an authorization code
    let url = new URL('https://mock-oauth.metorial.net/authorize');
    url.searchParams.set('client_id', ctx.clientId);
    url.searchParams.set('redirect_uri', ctx.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    return url.toString();
  },
  handleCallback: async ctx => {
    // Exchange authorization code for access token
    let tokenResponse = await fetch('https://mock-oauth.metorial.net/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code: ctx.code,
        client_id: ctx.clientId,
        client_secret: ctx.clientSecret,
        redirect_uri: ctx.redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to exchange code for token: ${tokenResponse.statusText}`);
    }

    let tokenData = await tokenResponse.json();

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      tokenType: tokenData.token_type
    };
  }
});

let add = McpTool.create('add')
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
  .handle(async input => {
    return {
      result: input.a + input.b
    };
  });

let stringify = McpTool.create('stringify')
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
  .handle(async input => {
    return {
      result: JSON.stringify(input.data, null, 2)
    };
  });

let printConfig = McpTool.create('printConfig')
  .output(
    z.object({
      config: z.any(),
      authConfig: z.any()
    })
  )
  .handle(async () => {
    return {
      config: (config as any).toJSON(),
      authConfig: authConfig.toJSON()
    };
  });

export default createMcpServer({
  name: 'Example MCP Server',
  version: '1.0.0',
  tools: [add, stringify, printConfig],
  config,
  authConfig
});
