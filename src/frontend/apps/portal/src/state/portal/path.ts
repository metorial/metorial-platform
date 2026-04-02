import { useBoot } from './client';
import { buildPortalPath } from './client';

let getPathBuilder = (portalUrl: string | null | undefined) => {
  return (...parts: (string | null | undefined)[]) => {
    if (!portalUrl) return '#';
    return buildPortalPath(portalUrl, ...parts);
  };
};

export let createPaths = (portalUrl: string | null | undefined) => {
  let getPath = getPathBuilder(portalUrl);

  return {
    home: () => getPath(),
    catalog: () => getPath('catalog'),
    login: () => getPath('login'),
    provider: (catalogItemId: string | null | undefined) => {
      if (!catalogItemId) return '#';
      return getPath('providers', catalogItemId);
    },
    magicMcpRoot: () => getPath('magic-mcp'),
    magicMcpServers: () => getPath('magic-mcp', 'servers'),
    magicMcpSessions: () => getPath('magic-mcp', 'sessions'),
    magicMcpTokens: () => getPath('magic-mcp', 'tokens'),
    magicMcpServerBase: () => getPath('magic-mcp', 'server'),
    magicMcpServer: (
      magicMcpServerId: string | null | undefined,
      ...parts: (string | null | undefined)[]
    ) => {
      if (!magicMcpServerId) return '#';
      return getPath('magic-mcp', 'server', magicMcpServerId, ...parts);
    },
    magicMcpServerSessions: (magicMcpServerId: string | null | undefined) => {
      if (!magicMcpServerId) return '#';
      return getPath('magic-mcp', 'server', magicMcpServerId, 'sessions');
    },
    magicMcpServerSettings: (magicMcpServerId: string | null | undefined) => {
      if (!magicMcpServerId) return '#';
      return getPath('magic-mcp', 'server', magicMcpServerId, 'settings');
    }
  };
};

export let usePaths = () => {
  let boot = useBoot();
  return createPaths(boot.data?.portalUrl ?? null);
};
