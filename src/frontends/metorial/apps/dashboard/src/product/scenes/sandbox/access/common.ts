export interface SandboxAccessGrant {
  url: string;
  token: string;
  expiresAt?: Date | string | null;
}

export type SandboxAccessProvider = () => Promise<SandboxAccessGrant>;

export type SandboxWebSocketFactory = (url: string, protocols: string[]) => WebSocket;

export let SOCKET_CONNECTING = 0;
export let SOCKET_OPEN = 1;

export let sandboxSocketProtocol = 'metorial-sandbox-v1';

export let getSandboxSocketProtocols = (token: string) => [
  sandboxSocketProtocol,
  `metorial-sandbox-token.${token}`
];

export let defaultSandboxWebSocketFactory: SandboxWebSocketFactory = (url, protocols) =>
  new WebSocket(url, protocols);

let ACCESS_EXPIRY_MARGIN_MS = 30 * 1000;

export let createSandboxAccessCache = (
  getAccess: SandboxAccessProvider,
  opts?: { now?: () => number }
) => {
  let now = opts?.now ?? Date.now;
  let grant: SandboxAccessGrant | null = null;
  let pending: Promise<SandboxAccessGrant> | null = null;

  let isUsable = (candidate: SandboxAccessGrant) => {
    if (!candidate.expiresAt) return true;

    let expiresAt = new Date(candidate.expiresAt).getTime();
    return Number.isNaN(expiresAt) || expiresAt - now() > ACCESS_EXPIRY_MARGIN_MS;
  };

  return {
    get: async (getOpts?: { force?: boolean }) => {
      if (!getOpts?.force && grant && isUsable(grant)) return grant;

      if (!pending) {
        grant = null;
        pending = getAccess()
          .then(next => {
            grant = next;
            return next;
          })
          .finally(() => {
            pending = null;
          });
      }

      return pending;
    },

    invalidate: () => {
      grant = null;
    }
  };
};

export type SandboxAccessCache = ReturnType<typeof createSandboxAccessCache>;

export interface SandboxConnectionNotice {
  type: 'connection_notice';
  notice: 'idle_warning' | 'idle' | 'active' | 'closing' | (string & {});
  idleInSeconds?: number;
  reason?: string;
}

export let isSandboxConnectionNotice = (
  message: unknown
): message is SandboxConnectionNotice =>
  typeof message == 'object' &&
  message !== null &&
  (message as { type?: unknown }).type == 'connection_notice';

let closingReasons: Record<string, string> = {
  machine_paused: 'The machine paused, so this connection was closed.',
  machine_restarting: 'The machine is restarting.',
  machine_terminated: 'The machine was terminated.',
  idle_timeout: 'This connection was closed after being idle.'
};

export let describeSandboxConnectionNotice = (
  notice: SandboxConnectionNotice
): { kind: 'idle_warning' | 'idle' | 'closing' | 'info'; message: string } | null => {
  switch (notice.notice) {
    case 'idle_warning': {
      let minutes = Math.max(1, Math.ceil((notice.idleInSeconds ?? 60) / 60));
      return {
        kind: 'idle_warning',
        message: `This shell goes idle in ${minutes} min. Type anything to keep the machine awake.`
      };
    }

    case 'idle':
      return {
        kind: 'idle',
        message: 'This shell is idle and no longer keeps the machine awake.'
      };

    case 'closing':
      return {
        kind: 'closing',
        message: closingReasons[notice.reason ?? ''] ?? 'This connection is closing.'
      };

    default:
      return null;
  }
};

export let sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export let getAccessErrorMessage = (error: unknown) => {
  let message = (error as { message?: unknown })?.message;

  return typeof message == 'string' && message
    ? `Could not get access to the machine: ${message}`
    : 'Could not get access to the machine.';
};
