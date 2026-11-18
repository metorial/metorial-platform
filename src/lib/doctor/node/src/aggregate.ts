import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { abortable } from './abortable';
import { describeError } from './errors';
import { parseReport } from './parse';
import {
  isFailing,
  type CheckCategory,
  type CheckDetails,
  type CheckSeverity,
  type CheckStatus,
  type Report,
  type Resolution
} from './types';

let defaultCollectTimeoutMs = 15_000;
let defaultPath = '/doctor';

let severityRank: Record<CheckSeverity, number> = { critical: 0, warning: 1, info: 2 };

let statusRank: Record<CheckStatus, number> = {
  error: 0,
  timeout: 0,
  fail: 0,
  warn: 1,
  skip: 2,
  pass: 3
};

export interface DoctorTarget {
  name: string;
  host: string;
  port: number;
  path?: string;
  optional?: boolean;
}

export type ReplicaOutcome =
  'ok' | 'unreachable' | 'timeout' | 'invalid_response' | 'unsupported';

export interface ReplicaReport {
  component: string;
  address: string;
  outcome: ReplicaOutcome;
  report: Report | null;
  error: string | null;
  durationMs: number;
}

export interface CollectOptions {
  fetch?: typeof fetch;
  resolve?: (host: string) => Promise<string[]>;
  timeoutMs?: number;
  fresh?: boolean;
}

export interface IssueSource {
  component: string;
  instance: string;
}

export interface Issue {
  key: string;
  id: string;
  title: string;
  category: CheckCategory;
  severity: CheckSeverity;
  status: CheckStatus;
  message: string;
  target: string | null;
  resolution: Resolution | null;
  details: CheckDetails | null;
  seenFrom: IssueSource[];
}

export type ComponentState = 'ok' | 'degraded' | 'unreachable' | 'pending';

export interface ComponentSummary {
  name: string;
  optional: boolean;
  state: ComponentState;
  replicas: {
    address: string;
    outcome: ReplicaOutcome;
    instance: string | null;
    runId: string | null;
    releaseVersion: string | null;
    buildVersion: string | null;
    error: string | null;
  }[];
}

export interface MergeOptions {
  pendingUnreachable?: boolean;
}

export interface MergedResult {
  components: ComponentSummary[];
  issues: Issue[];
  pending: string[];
  blocking: boolean;
  counts: { critical: number; warning: number; info: number; passed: number; skipped: number };
}

let defaultResolve = async (host: string) => {
  if (isIP(host)) return [host];

  let addresses = await lookup(host, { all: true });
  return [...new Set(addresses.map(item => item.address))];
};

let urlHost = (address: string) => (isIP(address) == 6 ? `[${address}]` : address);

let fetchReplica = async (
  target: DoctorTarget,
  address: string,
  opts: Required<Pick<CollectOptions, 'timeoutMs'>> & CollectOptions
): Promise<ReplicaReport> => {
  let fetchImpl = opts.fetch ?? fetch;
  let started = performance.now();
  let url = `http://${urlHost(address)}:${target.port}${target.path ?? defaultPath}${opts.fresh ? '?fresh=1' : ''}`;
  let replica = (outcome: ReplicaOutcome, report: Report | null, error: string | null) => ({
    component: target.name,
    address,
    outcome,
    report,
    error,
    durationMs: Math.round(performance.now() - started)
  });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(opts.timeoutMs)
    });
  } catch (error) {
    let info = describeError(error);
    return replica(info.kind == 'timeout' ? 'timeout' : 'unreachable', null, info.message);
  }

  if (response.status == 404) {
    await response.body?.cancel().catch(() => {});
    return replica('unsupported', null, 'The component does not serve a doctor report.');
  }

  try {
    let body = (await response.json()) as { error?: unknown } | null;
    if (!response.ok) {
      let message = typeof body?.error == 'string' ? body.error : `HTTP ${response.status}`;
      return replica('invalid_response', null, message);
    }

    return replica('ok', parseReport(body), null);
  } catch (error) {
    return replica('invalid_response', null, describeError(error).message);
  }
};

export let collectReports = async (
  targets: DoctorTarget[],
  options: CollectOptions = {}
): Promise<ReplicaReport[]> => {
  let resolve = options.resolve ?? defaultResolve;
  let opts = { ...options, timeoutMs: options.timeoutMs ?? defaultCollectTimeoutMs };

  let perTarget = await Promise.all(
    targets.map(async target => {
      let addresses: string[];
      try {
        addresses = await abortable(resolve(target.host), AbortSignal.timeout(opts.timeoutMs));
      } catch (error) {
        let info = describeError(error);

        return [
          {
            component: target.name,
            address: target.host,
            outcome: info.kind == 'timeout' ? ('timeout' as const) : ('unreachable' as const),
            report: null,
            error: info.message,
            durationMs: 0
          }
        ];
      }

      if (!addresses.length) {
        return [
          {
            component: target.name,
            address: target.host,
            outcome: 'unreachable' as const,
            report: null,
            error: `${target.host} has no addresses.`,
            durationMs: 0
          }
        ];
      }

      return Promise.all(addresses.map(address => fetchReplica(target, address, opts)));
    })
  );

  return perTarget.flat();
};

let componentIdPart = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'component';

let syntheticIssue = (
  target: DoctorTarget,
  check: string,
  severity: CheckSeverity,
  status: CheckStatus,
  title: string,
  message: string,
  resolution: Resolution,
  details: CheckDetails
): Issue => {
  let id = `components.${componentIdPart(target.name)}.${check}`;

  return {
    key: `${id}|@${target.name}`,
    id,
    title,
    category: 'runtime',
    severity,
    status,
    message,
    target: null,
    resolution,
    details,
    seenFrom: []
  };
};

let replicaDetails = (replicas: ReplicaReport[]): CheckDetails => ({
  replicas: replicas.map(replica => ({
    address: replica.address,
    outcome: replica.outcome,
    error: replica.error
  }))
});

let componentIssues = (target: DoctorTarget, replicas: ReplicaReport[], pending: boolean) => {
  let issues: Issue[] = [];
  let answered = replicas.filter(replica => replica.outcome == 'ok');
  let unsupported = replicas.filter(replica => replica.outcome == 'unsupported');
  let missing = replicas.filter(
    replica => replica.outcome != 'ok' && replica.outcome != 'unsupported'
  );

  if (!answered.length && !unsupported.length) {
    if (pending) return issues;

    issues.push(
      syntheticIssue(
        target,
        'reachable',
        target.optional ? 'warning' : 'critical',
        'fail',
        `${target.name} is reachable`,
        `No replica of ${target.name} answered.`,
        {
          summary: `Check that ${target.name} is running and that its doctor port is reachable.`,
          steps: [
            `Check the status and logs of the ${target.name} pods or containers.`,
            `Check that network policies allow traffic to ${target.name} on port ${target.port}.`
          ],
          docs: null
        },
        replicaDetails(replicas)
      )
    );

    return issues;
  }

  if (missing.length) {
    issues.push(
      syntheticIssue(
        target,
        'replicas',
        'warning',
        'fail',
        `All replicas of ${target.name} answer`,
        `${missing.length} of ${replicas.length} replicas of ${target.name} did not answer.`,
        {
          summary: `Check the replicas of ${target.name} that did not answer.`,
          steps: [],
          docs: null
        },
        replicaDetails(missing)
      )
    );
  }

  if (unsupported.length) {
    issues.push(
      syntheticIssue(
        target,
        'doctor-supported',
        'warning',
        'fail',
        `${target.name} serves doctor reports`,
        `${unsupported.length} of ${replicas.length} replicas of ${target.name} don't serve a doctor report.`,
        {
          summary: `${target.name} runs an older version. Finish the upgrade.`,
          steps: [],
          docs: null
        },
        replicaDetails(unsupported)
      )
    );
  }

  return issues;
};

let componentState = (replicas: ReplicaReport[], pending: boolean): ComponentState => {
  let answered = replicas.filter(replica => replica.outcome == 'ok').length;

  if (!answered) {
    if (replicas.some(replica => replica.outcome == 'unsupported')) return 'degraded';
    return pending ? 'pending' : 'unreachable';
  }

  return answered == replicas.length ? 'ok' : 'degraded';
};

export let mergeReports = (
  replicas: ReplicaReport[],
  targets: DoctorTarget[],
  options: MergeOptions = {}
): MergedResult => {
  let pendingUnreachable = options.pendingUnreachable ?? false;
  let issues = new Map<string, Issue>();
  let passed = new Set<string>();
  let skipped = new Set<string>();
  let components: ComponentSummary[] = [];
  let pending: string[] = [];
  let synthetic: Issue[] = [];

  let sorted = [...replicas].sort(
    (a, b) =>
      a.component.localeCompare(b.component) ||
      (a.report?.instance ?? a.address).localeCompare(b.report?.instance ?? b.address)
  );

  for (let target of targets) {
    let own = sorted.filter(replica => replica.component == target.name);
    let state = componentState(own, pendingUnreachable);

    if (state == 'pending') pending.push(target.name);
    synthetic.push(...componentIssues(target, own, pendingUnreachable));

    components.push({
      name: target.name,
      optional: target.optional ?? false,
      state,
      replicas: own.map(replica => ({
        address: replica.address,
        outcome: replica.outcome,
        instance: replica.report?.instance ?? null,
        runId: replica.report?.runId ?? null,
        releaseVersion: replica.report?.releaseVersion ?? null,
        buildVersion: replica.report?.buildVersion ?? null,
        error: replica.error
      }))
    });
  }

  for (let replica of sorted) {
    if (!replica.report) continue;

    for (let check of replica.report.checks) {
      let key = check.target
        ? `${check.id}|${check.target}`
        : `${check.id}|@${replica.component}`;
      let source = { component: replica.component, instance: replica.report.instance };

      if (check.status == 'pass') {
        passed.add(key);
        continue;
      }

      if (check.status == 'skip') {
        skipped.add(key);
        continue;
      }

      let existing = issues.get(key);
      if (!existing) {
        issues.set(key, {
          key,
          id: check.id,
          title: check.title,
          category: check.category,
          severity: check.severity,
          status: check.status,
          message: check.message,
          target: check.target,
          resolution: check.resolution,
          details: check.details,
          seenFrom: [source]
        });
        continue;
      }

      existing.seenFrom.push(source);
      if (severityRank[check.severity] < severityRank[existing.severity]) {
        existing.severity = check.severity;
      }
      if (statusRank[check.status] < statusRank[existing.status]) {
        Object.assign(existing, {
          status: check.status,
          message: check.message,
          resolution: check.resolution ?? existing.resolution,
          details: check.details
        });
      }
    }
  }

  for (let key of issues.keys()) {
    passed.delete(key);
    skipped.delete(key);
  }

  let allIssues = [...synthetic, ...issues.values()].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      statusRank[a.status] - statusRank[b.status] ||
      a.id.localeCompare(b.id) ||
      a.key.localeCompare(b.key)
  );

  let critical = allIssues.filter(
    issue => issue.severity == 'critical' && isFailing(issue.status)
  ).length;
  let info = allIssues.filter(issue => issue.severity == 'info').length;

  return {
    components,
    issues: allIssues,
    pending,
    blocking: critical > 0,
    counts: {
      critical,
      warning: allIssues.length - critical - info,
      info,
      passed: passed.size,
      skipped: skipped.size
    }
  };
};
