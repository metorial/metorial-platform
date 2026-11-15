import { gunzipSync, gzipSync } from 'node:zlib';
import { Bash, InMemoryFs, MountableFs, type InitialFiles } from './fs/justBash';
import { readOnlyFs } from './fs/readOnlyFs';

let WORKSPACE_FORMAT = 'review-workspace/v1';
let MAX_WORKSPACE_BYTES = 32 * 1024 * 1024;
let MAX_BASE_BYTES = 8 * 1024 * 1024;
let MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
let MAX_HISTORY_BYTES = 8 * 1024 * 1024;
let MAX_REPORT_BYTES = 4 * 1024 * 1024;
let MAX_EXECUTIONS = 512;
let MAX_TOTAL_EXECUTION_MS = 2 * 60 * 1000;
let MAX_STDOUT = 40_000;
let MAX_STDERR = 8_000;

let EXECUTION_LIMITS = {
  maxExecutionTimeMs: 30_000,
  maxSourceBytes: 256 * 1024,
  maxOutputSize: 256 * 1024,
  maxLiveBytes: 64 * 1024 * 1024,
  maxInputBytes: 32 * 1024 * 1024,
  maxStringLength: 2 * 1024 * 1024,
  maxHeredocSize: 256 * 1024,

  maxCommandCount: 2_000,
  maxLoopIterations: 2_000,
  maxExecDepth: 8,
  maxCallDepth: 32,
  maxSourceDepth: 8,
  maxSubstitutionDepth: 8,
  maxBraceExpansionResults: 1_000,
  maxArrayElements: 10_000,
  maxFileDescriptors: 64,
  maxGlobOperations: 10_000,

  maxWorkUnits: 100_000,
  maxTraversalEntries: 10_000,
  maxTraversalDepth: 64,
  maxTraversalWork: 20_000,
  maxQueryTokens: 10_000,
  maxQueryDepth: 64,
  maxQueryElements: 10_000,
  maxAwkParserTokens: 10_000,
  maxAwkParserDepth: 64,
  maxCsvRows: 10_000,
  maxCsvCells: 100_000,

  maxDatabaseBytes: 8 * 1024 * 1024,
  maxDatabaseResultBytes: 256 * 1024,
  maxSqliteTimeoutMs: 1_000,
  maxWorkerMessageBytes: 16 * 1024 * 1024,
  maxArchiveBytes: 16 * 1024 * 1024,
  maxArchiveCompressedBytes: 8 * 1024 * 1024,
  maxArchiveEntryBytes: 4 * 1024 * 1024,
  maxArchiveEntries: 1_000
};

export let WORKSPACE_MOUNTS = {
  evidence: '/evidence',
  history: '/history',
  workspace: '/workspace',
  report: '/report'
} as const;

export interface WorkspaceStore {
  load(key: string): Promise<Uint8Array | null>;
  save(key: string, data: Uint8Array): Promise<void>;
}

type SerializedWorkspace = {
  format: string;
  files: Record<string, string>;
};

export type ReviewWorkspace = Awaited<ReturnType<typeof createReviewWorkspace>>;

let toInitialFiles = (files: Record<string, string | Uint8Array>): InitialFiles => {
  let initial: InitialFiles = {};
  for (let [path, content] of Object.entries(files)) {
    initial[path.startsWith('/') ? path : `/${path}`] = content;
  }
  return initial;
};

let truncate = (value: string, max: number) =>
  value.length > max
    ? `${value.slice(0, max)}\n… [truncated ${value.length - max} chars]`
    : value;

export let createReviewWorkspace = async (d: {
  evidence: Record<string, string | Uint8Array>;
  history: Record<string, string | Uint8Array>;
  workspace?: Record<string, string | Uint8Array>;
  report?: Record<string, string>;
  abortSignal?: AbortSignal;
}) => {
  let workspaceFs = new InMemoryFs(toInitialFiles(d.workspace ?? {}), {
    maxTotalBytes: MAX_WORKSPACE_BYTES
  });
  let reportFs = new InMemoryFs(toInitialFiles(d.report ?? {}), {
    maxTotalBytes: MAX_REPORT_BYTES
  });

  // Bash installs command stubs in the writable base layer; its quota also covers /tmp.
  let fs = new MountableFs({
    base: new InMemoryFs(
      { '/home/reviewer/.keep': '', '/tmp/.keep': '' },
      { maxTotalBytes: MAX_BASE_BYTES }
    ),
    mounts: [
      {
        mountPoint: WORKSPACE_MOUNTS.evidence,
        filesystem: readOnlyFs(
          new InMemoryFs(toInitialFiles(d.evidence), { maxTotalBytes: MAX_EVIDENCE_BYTES })
        )
      },
      {
        mountPoint: WORKSPACE_MOUNTS.history,
        filesystem: readOnlyFs(
          new InMemoryFs(toInitialFiles(d.history), { maxTotalBytes: MAX_HISTORY_BYTES })
        )
      },
      { mountPoint: WORKSPACE_MOUNTS.workspace, filesystem: workspaceFs },
      { mountPoint: WORKSPACE_MOUNTS.report, filesystem: readOnlyFs(reportFs) }
    ]
  });

  let bash = new Bash({
    fs,
    cwd: WORKSPACE_MOUNTS.workspace,
    env: { HOME: '/home/reviewer', PWD: WORKSPACE_MOUNTS.workspace },
    executionLimitProfile: 'hardened',
    executionLimits: EXECUTION_LIMITS,
    python: false,
    javascript: false
  });

  let executions = 0;
  let executionMs = 0;
  let pending: Promise<unknown> = Promise.resolve();

  return {
    fs,

    async exec(command: string, options?: { signal?: AbortSignal }) {
      if (++executions > MAX_EXECUTIONS) {
        return {
          exitCode: 126,
          stdout: '',
          stderr: 'Review shell command budget exhausted'
        };
      }

      let execute = async () => {
        if (executionMs >= MAX_TOTAL_EXECUTION_MS) {
          return {
            exitCode: 126,
            stdout: '',
            stderr: 'Review shell execution time budget exhausted'
          };
        }

        let signals = [d.abortSignal, options?.signal].filter(
          (signal): signal is AbortSignal => !!signal
        );
        let timeout = AbortSignal.timeout(MAX_TOTAL_EXECUTION_MS - executionMs);
        let signal = AbortSignal.any([...signals, timeout]);
        let startedAt = performance.now();

        let result: { exitCode: number; stdout: string; stderr: string };
        try {
          result = await bash.exec(command, { signal });
        } catch (error) {
          result = {
            exitCode: 1,
            stdout: '',
            stderr: error instanceof Error ? error.message : String(error)
          };
        } finally {
          executionMs += Math.ceil(performance.now() - startedAt);
        }

        return {
          exitCode: result.exitCode,
          stdout: truncate(result.stdout, MAX_STDOUT),
          stderr: truncate(result.stderr, MAX_STDERR)
        };
      };

      let result = pending.then(execute);
      pending = result.catch(() => {});

      return await result;
    },

    async writeWorkspaceFile(path: string, content: string | Uint8Array) {
      await workspaceFs.writeFile(path, content);
    },

    async writeReportFile(path: string, content: string) {
      await reportFs.writeFile(path, content);
    },

    async readReportFile(path: string) {
      if (!(await reportFs.exists(path))) return null;
      return await reportFs.readFile(path, 'utf8');
    },

    async serializeWorkspace(): Promise<Uint8Array> {
      let files: Record<string, string> = {};

      for (let path of workspaceFs.getAllPaths()) {
        let stat = await workspaceFs.stat(path);
        if (!stat.isFile) continue;

        files[path] = Buffer.from(await workspaceFs.readFileBuffer(path)).toString('base64');
      }

      let serialized: SerializedWorkspace = { format: WORKSPACE_FORMAT, files };
      return gzipSync(Buffer.from(JSON.stringify(serialized)));
    }
  };
};

export let deserializeWorkspace = (data: Uint8Array): Record<string, Uint8Array> => {
  let parsed = JSON.parse(gunzipSync(data).toString('utf8')) as SerializedWorkspace;
  if (parsed.format != WORKSPACE_FORMAT) return {};

  let files: Record<string, Uint8Array> = {};
  for (let [path, base64] of Object.entries(parsed.files)) {
    files[path] = new Uint8Array(Buffer.from(base64, 'base64'));
  }

  return files;
};
