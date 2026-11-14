import { safeFetch } from '@lowerdeck/ssrf';
import type { SecurityFindingSeverityLevel } from '@metorial-subspace/db';

let OSV_TIMEOUT_MS = 10_000;
let OSV_MAX_DETAILS = 25;

export type SecretHit = { path: string; line: number; kind: string };

let secretPatterns: { kind: string; pattern: RegExp }[] = [
  { kind: 'aws_access_key', pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: 'private_key', pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { kind: 'github_token', pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { kind: 'slack_token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: 'stripe_live_key', pattern: /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/ },
  { kind: 'anthropic_key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { kind: 'openai_key', pattern: /\bsk-(proj-)?[A-Za-z0-9]{32,}\b/ },
  { kind: 'google_api_key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    kind: 'hardcoded_credential',
    pattern:
      /\b(api[_-]?key|secret|password|passwd|token|client[_-]?secret)\b\s*[:=]\s*['"][A-Za-z0-9+/=_\-.]{20,}['"]/i
  }
];

let isLikelyBinary = (content: string) => content.includes('\u0000');

export let scanSecrets = (files: Record<string, string>): SecretHit[] => {
  let hits: SecretHit[] = [];

  for (let [path, content] of Object.entries(files)) {
    if (
      isLikelyBinary(content) ||
      /(^|\/)(package-lock\.json|bun\.lockb?|yarn\.lock)$/.test(path)
    ) {
      continue;
    }

    content.split('\n').forEach((line, i) => {
      for (let { kind, pattern } of secretPatterns) {
        if (pattern.test(line)) hits.push({ path, line: i + 1, kind });
      }
    });
  }

  return hits;
};

let reviewerAddressingPatterns = [
  /ignore (all |any )?(previous|prior|above) (instructions|prompts?)/i,
  /\b(security|safety) (review(er)?|audit(or)?|scanner)s?\b.{0,60}\b(should|must|ignore|skip|approve|rate)\b/i,
  /\b(rate|score|mark|classify) (this|it) (as )?(safe|secure|trusted|low risk)\b/i,
  /\bdo not (tell|inform|mention|reveal) (this )?(to )?the user\b/i
];

export let addressesReviewer = (text: string) =>
  reviewerAddressingPatterns.some(pattern => pattern.test(text));

export type Dependency = { ecosystem: 'npm' | 'PyPI'; name: string; version: string };

export let parseLockfiles = (files: Record<string, string>): Dependency[] => {
  let dependencies = new Map<string, Dependency>();
  let add = (dependency: Dependency) =>
    dependencies.set(
      `${dependency.ecosystem}:${dependency.name}@${dependency.version}`,
      dependency
    );

  for (let [path, content] of Object.entries(files)) {
    if (path.includes('node_modules/')) continue;

    if (path.endsWith('package-lock.json')) {
      try {
        let lock = JSON.parse(content);
        for (let [key, value] of Object.entries<any>(lock.packages ?? {})) {
          if (!key || !value?.version) continue;
          add({
            ecosystem: 'npm',
            name: key.replace(/^.*node_modules\//, ''),
            version: value.version
          });
        }
      } catch {}
    }

    if (path.endsWith('requirements.txt')) {
      for (let line of content.split('\n')) {
        let match = line.trim().match(/^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)/);
        if (match) add({ ecosystem: 'PyPI', name: match[1]!, version: match[2]! });
      }
    }
  }

  return [...dependencies.values()];
};

export type DependencyAdvisory = {
  dependency: Dependency;
  id: string;
  summary: string;
  severity: SecurityFindingSeverityLevel;
};

let mapOsvSeverity = (vuln: any): SecurityFindingSeverityLevel => {
  let label = String(vuln?.database_specific?.severity ?? '').toUpperCase();
  if (label == 'CRITICAL') return 'critical';
  if (label == 'HIGH') return 'high';
  if (label == 'MODERATE' || label == 'MEDIUM') return 'medium';
  if (label == 'LOW') return 'low';
  return 'medium';
};

let osvPost = async (path: string, body: unknown) => {
  let response = await safeFetch(`https://api.osv.dev${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(OSV_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`OSV request failed with status ${response.status}`);
  return await response.json();
};

let osvGet = async (path: string) => {
  let response = await safeFetch(`https://api.osv.dev${path}`, {
    signal: AbortSignal.timeout(OSV_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`OSV request failed with status ${response.status}`);
  return await response.json();
};

export let queryAdvisories = async (
  dependencies: Dependency[]
): Promise<DependencyAdvisory[]> => {
  if (!dependencies.length) return [];

  let batch = await osvPost('/v1/querybatch', {
    queries: dependencies.map(dependency => ({
      package: { name: dependency.name, ecosystem: dependency.ecosystem },
      version: dependency.version
    }))
  });

  let matches = (batch.results as any[]).flatMap((result, i) =>
    ((result?.vulns ?? []) as any[]).map(vuln => ({
      dependency: dependencies[i]!,
      id: String(vuln.id)
    }))
  );

  let advisories: DependencyAdvisory[] = [];
  for (let match of matches.slice(0, OSV_MAX_DETAILS)) {
    let vuln = await osvGet(`/v1/vulns/${encodeURIComponent(match.id)}`).catch(() => null);
    advisories.push({
      ...match,
      summary: String(vuln?.summary ?? match.id),
      severity: mapOsvSeverity(vuln)
    });
  }

  return advisories;
};
