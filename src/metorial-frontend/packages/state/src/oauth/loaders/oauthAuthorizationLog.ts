import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let oauthAuthorizationLogsLoader = createLoader({
  name: 'oauthAuthorizationLogs',
  fetch: (i: {
    organizationId: string;
    before?: string;
    after?: string;
    appId?: string | string[];
    userId?: string | string[];
  }) =>
    withAuth(sdk =>
      sdk.oauth.authorizationLogs.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100,
        appId: i.appId,
        userId: i.userId
      })
    ),
  mutators: {}
});

export let useOAuthAuthorizationLogs = (
  organizationId: string | null | undefined,
  opts?: {
    appIds?: string[];
    userIds?: string[];
  }
) => {
  return usePaginator(cursor =>
    oauthAuthorizationLogsLoader.use(
      organizationId
        ? {
            organizationId,
            ...cursor,
            appId: opts?.appIds?.length ? opts.appIds : undefined,
            userId: opts?.userIds?.length ? opts.userIds : undefined
          }
        : null
    )
  );
};
