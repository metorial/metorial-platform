import { joinPaths } from '@metorial/join-paths';
import { useMemo } from 'react';
import { useBoot } from './client';

export type EntityParam = { id: string; slug: string } | null | undefined;
export type SubPages = (string | null | undefined | object)[];

export let usePaths = () => {
  let boot = useBoot();

  let basePath = useMemo(() => {
    if (!boot.data) return undefined;

    let portalUrl = new URL(boot.data.portalUrl);
    let basePath = portalUrl.pathname.split('/').filter(Boolean).join('/');
    if (basePath == '/') return '';
    return basePath;
  }, [boot.data]);

  return useMemo(() => {
    let InstancePaths = Object.assign(
      (...subPages: SubPages) => {
        if (basePath === undefined || !boot.data) return '#';

        return joinPaths(basePath, ...subPages);
      },
      {
        home: () => InstancePaths(),
        tokens: () => InstancePaths('tokens'),
        settings: (...subPages: SubPages) => InstancePaths('settings', ...subPages),

        servers: () => InstancePaths('servers'),
        server: (serverId: string | null | undefined, ...subPages: SubPages) => {
          if (!serverId) return '#';
          return InstancePaths('servers', serverId, ...subPages);
        },

        magicMcpServer: (...subPages: SubPages) =>
          InstancePaths('magic-mcp-server', ...subPages),
        magicMcpSessions: (...subPages: SubPages) =>
          InstancePaths('magic-mcp-sessions', ...subPages),

        explorer: (...subPages: SubPages) => InstancePaths('explorer', ...subPages)
      }
    );

    return InstancePaths;
  }, [boot.data, basePath]);
};
