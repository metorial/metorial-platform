import type { Instance } from '@metorial/db';
import { forbiddenError, ServiceError, unauthorizedError } from '@metorial/error';
import { AuthInfo } from '@metorial/module-access';
import { Authenticator } from '@metorial/rest';

export type McpSessionInfo = {
  instance: Instance;
  auth: AuthInfo;
};

export let authenticateAndResolveInstance = async (
  request: Request,
  url: URL,
  authenticate: Authenticator<AuthInfo>
): Promise<McpSessionInfo> => {
  let result = await authenticate(request, url);
  let auth = result.auth;

  if (auth.type === 'machine') {
    if ('instance' in auth.restrictions) {
      return {
        instance: {
          ...auth.restrictions.instance,
          organization: auth.restrictions.organization
        } as Instance,
        auth
      };
    }

    throw new ServiceError(
      forbiddenError({
        message: 'Instance-scoped API key required for MCP connections',
        description:
          'Organization-scoped API keys cannot be used with the MCP proxy. Use an instance-scoped API key instead.'
      })
    );
  }

  throw new ServiceError(
    unauthorizedError({
      message: 'API key authentication required',
      description:
        'MCP gateway connections require an API key. Use a Bearer token with your API key.'
    })
  );
};
