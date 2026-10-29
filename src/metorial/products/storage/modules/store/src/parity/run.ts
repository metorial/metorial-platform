import { parityChecks, type ParityCheck, type ParityFlag } from './checks';

export type ParityQuery = (sql: string) => Promise<Record<string, unknown>[]>;

export type ParityOptions = {
  projectOid?: bigint | number | string;
  since?: Date;
  sampleSize?: number;
  checkIds?: string[];
};

export type ParityViolation = {
  projectOid: string | null;
  organizationOid: string | null;
  ref: string;
  detail: string;
  createdAt: string | null;
};

export type ParityProjectCount = {
  projectOid: string | null;
  violations: number;
  recentViolations: number;
  population: number;
};

export type ParityCheckResult = {
  id: string;
  flag: ParityFlag;
  title: string;
  violations: number;
  recentViolations: number;
  population: number;
  byProject: ParityProjectCount[];
  samples: ParityViolation[];
  error?: string;
};

export type ParityProject = {
  projectOid: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
};

export type ParityReport = {
  generatedAt: string;
  scope: { projectOid?: string; since?: string };
  checks: ParityCheckResult[];
  projects: Record<string, ParityProject>;
  readiness: Record<ParityFlag, { ready: boolean; projectsWithViolations: string[] }>;
};

let flags: ParityFlag[] = ['store-participants-v2', 'store-access-v2'];

let defaultSampleSize = 10;

let oidLiteral = (value: bigint | number | string) => {
  let text = String(value);
  if (!/^\d+$/.test(text)) throw new Error(`Invalid project oid: ${text}`);
  return text;
};

let nullableString = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

let toInt = (value: unknown) => Number(value ?? 0);

let toIso = (value: unknown) => {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
};

let scoped = (sql: string, projectOid?: string) =>
  projectOid
    ? `SELECT * FROM (${sql}) scoped
       WHERE scoped."projectOid" = ${projectOid}
         OR (
           scoped."projectOid" IS NULL
           AND scoped."organizationOid" = (
             SELECT p."organizationOid" FROM "Project" p WHERE p.oid = ${projectOid}
           )
         )`
    : sql;

let runCheck = async (
  check: ParityCheck,
  query: ParityQuery,
  d: { projectOid?: string; since?: Date; sampleSize: number }
): Promise<ParityCheckResult> => {
  let sinceLiteral = d.since
    ? `'${d.since.toISOString()}'::timestamp`
    : `'infinity'::timestamp`;

  try {
    let violationRows = await query(`
      SELECT "projectOid",
        count(*)::int AS total,
        count(*) FILTER (WHERE "createdAt" >= ${sinceLiteral})::int AS recent
      FROM (${scoped(check.violations, d.projectOid)}) violation
      GROUP BY "projectOid"`);
    let populationRows = await query(`
      SELECT "projectOid", count(*)::int AS total
      FROM (${scoped(`SELECT * FROM (${check.population}) p`, d.projectOid)}) population
      GROUP BY "projectOid"`);
    let sampleRows = await query(`
      SELECT * FROM (${scoped(check.violations, d.projectOid)}) violation
      ORDER BY "createdAt" DESC NULLS LAST, ref
      LIMIT ${d.sampleSize}`);

    let byProject = new Map<string, ParityProjectCount>();
    let entry = (projectOid: string | null) => {
      let key = projectOid ?? '';
      let existing = byProject.get(key);
      if (existing) return existing;

      let created = { projectOid, violations: 0, recentViolations: 0, population: 0 };
      byProject.set(key, created);
      return created;
    };

    for (let item of violationRows) {
      let count = entry(nullableString(item.projectOid));
      count.violations = toInt(item.total);
      count.recentViolations = toInt(item.recent);
    }
    for (let item of populationRows) {
      entry(nullableString(item.projectOid)).population = toInt(item.total);
    }

    let counts = [...byProject.values()].sort(
      (a, b) => b.violations - a.violations || b.population - a.population
    );

    return {
      id: check.id,
      flag: check.flag,
      title: check.title,
      violations: counts.reduce((sum, item) => sum + item.violations, 0),
      recentViolations: counts.reduce((sum, item) => sum + item.recentViolations, 0),
      population: counts.reduce((sum, item) => sum + item.population, 0),
      byProject: counts,
      samples: sampleRows.map(item => ({
        projectOid: nullableString(item.projectOid),
        organizationOid: nullableString(item.organizationOid),
        ref: String(item.ref),
        detail: String(item.detail),
        createdAt: toIso(item.createdAt)
      }))
    };
  } catch (error) {
    return {
      id: check.id,
      flag: check.flag,
      title: check.title,
      violations: 0,
      recentViolations: 0,
      population: 0,
      byProject: [],
      samples: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

let loadProjects = async (query: ParityQuery, projectOids: string[]) => {
  if (!projectOids.length) return {};

  let rows = await query(`
    SELECT p.oid AS "projectOid", p.id AS "projectId", p.name AS "projectName",
      o.id AS "organizationId", o.name AS "organizationName"
    FROM "Project" p
    JOIN "Organization" o ON o.oid = p."organizationOid"
    WHERE p.oid IN (${projectOids.join(', ')})`);

  return Object.fromEntries(
    rows.map(item => [
      String(item.projectOid),
      {
        projectOid: String(item.projectOid),
        projectId: String(item.projectId),
        projectName: String(item.projectName),
        organizationId: String(item.organizationId),
        organizationName: String(item.organizationName)
      } satisfies ParityProject
    ])
  );
};

export let runStoreResourceParity = async (
  query: ParityQuery,
  options: ParityOptions = {}
): Promise<ParityReport> => {
  let projectOid =
    options.projectOid === undefined ? undefined : oidLiteral(options.projectOid);
  let selected = parityChecks().filter(
    check => !options.checkIds || options.checkIds.includes(check.id)
  );

  let unknown = (options.checkIds ?? []).filter(id => !selected.some(check => check.id == id));
  if (unknown.length) throw new Error(`Unknown parity checks: ${unknown.join(', ')}`);

  let checks: ParityCheckResult[] = [];
  for (let check of selected) {
    checks.push(
      await runCheck(check, query, {
        projectOid,
        since: options.since,
        sampleSize: options.sampleSize ?? defaultSampleSize
      })
    );
  }

  let projectOids = [
    ...new Set(
      checks.flatMap(check =>
        check.byProject
          .map(item => item.projectOid)
          .filter((item): item is string => item !== null)
      )
    )
  ];

  let readiness = Object.fromEntries(
    flags.map(flag => {
      let relevant = checks.filter(check => check.flag == flag);
      let withViolations = new Set<string>();
      for (let check of relevant) {
        for (let item of check.byProject) {
          if (item.violations > 0) withViolations.add(item.projectOid ?? 'organization');
        }
      }

      return [
        flag,
        {
          ready: relevant.every(check => !check.error && check.violations == 0),
          projectsWithViolations: [...withViolations]
        }
      ];
    })
  ) as ParityReport['readiness'];

  return {
    generatedAt: new Date().toISOString(),
    scope: { projectOid, since: options.since?.toISOString() },
    checks,
    projects: await loadProjects(query, projectOids),
    readiness
  };
};

let projectLabel = (report: ParityReport, projectOid: string | null) => {
  if (projectOid === null) return 'organization-level';

  let project = report.projects[projectOid];
  return project
    ? `${project.projectId} (${project.organizationName} / ${project.projectName})`
    : `project ${projectOid}`;
};

export let formatParityReport = (report: ParityReport) => {
  let lines: string[] = [];
  let since = report.scope.since;

  lines.push(`Store resource parity, generated ${report.generatedAt}`);
  if (report.scope.projectOid) lines.push(`Scope: project ${report.scope.projectOid}`);
  if (since) lines.push(`Recent means created at or after ${since}`);

  for (let flag of flags) {
    lines.push('', `== ${flag}`);

    for (let check of report.checks.filter(item => item.flag == flag)) {
      if (check.error) {
        lines.push(`  ERROR  ${check.id}: ${check.error}`);
        continue;
      }

      let status = check.violations == 0 ? 'ok   ' : 'DIFF ';
      let recent = since && check.violations > 0 ? `, ${check.recentViolations} recent` : '';
      lines.push(
        `  ${status} ${check.id}: ${check.violations} of ${check.population}${recent}  ${check.title}`
      );

      for (let item of check.byProject.filter(entry => entry.violations > 0)) {
        lines.push(
          `         ${projectLabel(report, item.projectOid)}: ${item.violations} of ${item.population}`
        );
      }
      for (let item of check.samples) {
        lines.push(`           ${item.ref}  ${item.detail}`);
      }
    }

    let readiness = report.readiness[flag];
    lines.push(
      readiness.ready
        ? `  -> no differences, ${flag} can be enabled`
        : `  -> NOT ready, ${readiness.projectsWithViolations.length} project(s) with differences`
    );
  }

  return lines.join('\n');
};
