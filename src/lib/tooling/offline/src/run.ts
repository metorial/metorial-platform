import { isOfflinePlaceholderTarget } from './env';
import {
  formatBlockedConnections,
  getBackgroundErrors,
  getBlockedConnections,
  type BlockedConnection
} from './guard';
import { installOfflineMode } from './install';

let matchesHost = (target: string, host: string) =>
  target.includes(`//${host}/`) || target.includes(`//${host}:`) || target.startsWith(`${host}:`);

// Attempts against the placeholder host are clients doing what the offline env told them to,
// and known background hosts are fire-and-forget warmups. Anything else means code reached
// for a real address on its own, which is what strict mode guards against.
let reportBlockedConnections = (knownBackgroundHosts: string[]) => {
  let blocked = getBlockedConnections();
  let isExpected = ({ target }: BlockedConnection) =>
    isOfflinePlaceholderTarget(target) ||
    knownBackgroundHosts.some(host => matchesHost(target, host));

  let expected = blocked.filter(isExpected);
  let unexpected = blocked.filter(connection => !isExpected(connection));

  if (expected.length) {
    let details =
      process.env.OFFLINE_DEBUG == '1' ? `:\n${formatBlockedConnections(expected)}` : '.';
    console.warn(
      `Offline mode refused ${expected.length} expected connection attempt(s)${details}`
    );
  }

  if (unexpected.length) {
    console.warn(
      `Offline mode blocked ${unexpected.length} unexpected connection attempt(s):\n${formatBlockedConnections(unexpected)}`
    );
  }

  return unexpected.length;
};

export let runOffline = async (
  task: () => Promise<void>,
  opts: {
    strict?: boolean;
    timeoutMs?: number;
    knownBackgroundHosts?: string[];
    onError?: (error: unknown) => string | undefined;
  } = {}
) => {
  installOfflineMode();

  let strict =
    opts.strict ?? (process.argv.includes('--strict') || process.env.OFFLINE_STRICT == '1');
  let knownBackgroundHosts = opts.knownBackgroundHosts ?? [];

  let timeoutMs = opts.timeoutMs ?? 120_000;
  let timeout = setTimeout(() => {
    console.error(
      `Offline task did not finish within ${timeoutMs}ms. Something on the import path is likely awaiting an external connection.`
    );
    reportBlockedConnections(knownBackgroundHosts);
    process.exit(1);
  }, timeoutMs);

  try {
    await task();
  } catch (error) {
    console.error(error);
    let hint = opts.onError?.(error);
    if (hint) console.error(`\n${hint}`);
    reportBlockedConnections(knownBackgroundHosts);
    process.exit(1);
  }

  clearTimeout(timeout);

  let backgroundErrors = getBackgroundErrors();
  if (backgroundErrors.length) {
    console.warn(
      `Ignored ${backgroundErrors.length} background error(s) from import-time side effects (set OFFLINE_DEBUG=1 to print them).`
    );
  }

  if (reportBlockedConnections(knownBackgroundHosts) && strict) {
    console.error('Strict offline mode: unexpected outbound connections were attempted.');
    process.exit(1);
  }

  process.exit(0);
};
