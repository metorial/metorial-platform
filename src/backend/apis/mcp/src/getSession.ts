import { extractToken } from '@metorial/bearer';
import { ServiceError, unauthorizedError } from '@metorial/error';
import { accessService, AuthInfo } from '@metorial/module-access';
import { sessionService } from '@metorial/module-session';
import { Authenticator } from '@metorial/rest';

export let getSessionAndAuthenticate = async (
  sessionId: string,
  request: Request,
  url: URL,
  authenticate: Authenticator<AuthInfo>
) => {
  let authTokenSecret = extractToken(request, url);
  if (authTokenSecret?.startsWith('metorial_ek_')) {
    let session = await sessionService.getSessionByClientSecret({
      clientSecret: authTokenSecret
    });
    if (session.id != sessionId) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Session ID mismatch',
          description: `The session ID in the URL does not match the session ID the client secret is associated with.`
        })
      );
    }

    return {
      type: 'session_client_secret' as const,
      session
    };
  }

  let auth = await authenticate(request, url);

  let session = await sessionService.DANGEROUSLY_getSessionOnlyById({
    sessionId
  });

  let instance = await accessService.accessInstance({
    authInfo: auth.auth,
    instanceId: session.instance.id
  });

  return {
    session,
    ...auth,
    ...instance,

    type: 'authenticated' as const
  };
};

export type SessionInfo = Awaited<ReturnType<typeof getSessionAndAuthenticate>>;
