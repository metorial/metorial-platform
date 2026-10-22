import { Paths } from '@metorial/frontend-config';
import type { EventsChartBucket } from '@metorial/metrics-page';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { UsageFilter } from './query';

export let createdFromParam = 'createdAt_gte';
export let createdToParam = 'createdAt_lte';
export let providerParam = 'provider_id';

export type UsageLogsTarget = 'toolCalls' | 'sessions' | 'connections';

let logsPaths = {
  toolCalls: Paths.instance.toolCalls,
  sessions: Paths.instance.providerSessions,
  connections: Paths.instance.sessionConnections
} satisfies Record<UsageLogsTarget, unknown>;

let providerParams: Record<UsageLogsTarget, string | undefined> = {
  toolCalls: providerParam,
  sessions: 'providerId',
  connections: undefined
};

let segmentStatus: Record<string, string> = {
  success: 'succeeded',
  error: 'failed'
};

export let useUsageLogsLink = (target: UsageLogsTarget, filter?: UsageFilter) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let location = useLocation();

  let filterKey = JSON.stringify(filter ?? {});

  return useCallback(
    (bucket: EventsChartBucket, segment?: string) => {
      let status = target == 'toolCalls' && segment ? segmentStatus[segment] : undefined;

      let query: Record<string, string> = {
        [createdFromParam]: bucket.from.toISOString(),
        [createdToParam]: new Date(bucket.to.getTime() - 1).toISOString()
      };
      if (status) query.status = status;
      if (filter?.consumerId) query.consumerId = filter.consumerId;
      let providerKey = providerParams[target];
      if (filter?.providerId && providerKey) query[providerKey] = filter.providerId;

      let path = logsPaths[target](organization.data, project.data, instance.data);
      if (path == location.pathname) {
        let next = new URLSearchParams(location.search);
        for (let key of [...next.keys()]) {
          if (key.startsWith('createdAt') || key == 'before' || key == 'after')
            next.delete(key);
        }
        for (let [key, value] of Object.entries(query)) next.set(key, value);
        return navigate({ pathname: path, search: next.toString() });
      }

      navigate(logsPaths[target](organization.data, project.data, instance.data, query));
    },
    [
      target,
      filterKey,
      organization.data,
      project.data,
      instance.data,
      navigate,
      location.pathname,
      location.search
    ]
  );
};
