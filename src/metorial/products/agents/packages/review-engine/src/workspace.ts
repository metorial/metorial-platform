import { gunzipSync, gzipSync } from 'node:zlib';
import { Bash, InMemoryFs, MountableFs, type InitialFiles } from './fs/justBash';
import { readOnlyFs } from './fs/readOnlyFs';

let WORKSPACE_FORMAT = 'review-workspace/v1';
let MAX_WORKSPACE_BYTES = 32 * 1024 * 1024;
let MAX_STDOUT = 40_000;
let MAX_STDERR = 8_000;

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
}) => {
  let workspaceFs = new InMemoryFs(toInitialFiles(d.workspace ?? {}), {
    maxTotalBytes: MAX_WORKSPACE_BYTES
  });
  let reportFs = new InMemoryFs(toInitialFiles(d.report ?? {}));

  // The base layer stays writable because Bash installs its command stubs under /bin and
  // /usr/bin at construction. Nothing outside /workspace is persisted, so this is harmless.
  let fs = new MountableFs({
    base: new InMemoryFs({ '/home/reviewer/.keep': '', '/tmp/.keep': '' }),
    mounts: [
      {
        mountPoint: WORKSPACE_MOUNTS.evidence,
        filesystem: readOnlyFs(new InMemoryFs(toInitialFiles(d.evidence)))
      },
      {
        mountPoint: WORKSPACE_MOUNTS.history,
        filesystem: readOnlyFs(new InMemoryFs(toInitialFiles(d.history)))
      },
      { mountPoint: WORKSPACE_MOUNTS.workspace, filesystem: workspaceFs },
      { mountPoint: WORKSPACE_MOUNTS.report, filesystem: readOnlyFs(reportFs) }
    ]
  });

  let bash = new Bash({
    fs,
    cwd: WORKSPACE_MOUNTS.workspace,
    env: { HOME: '/home/reviewer', PWD: WORKSPACE_MOUNTS.workspace },
    executionLimits: { maxCommandCount: 10_000, maxLoopIterations: 10_000 }
  });

  return {
    fs,

    async exec(command: string) {
      let result: { exitCode: number; stdout: string; stderr: string };
      try {
        result = await bash.exec(command);
      } catch (error) {
        result = {
          exitCode: 1,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error)
        };
      }

      return {
        exitCode: result.exitCode,
        stdout: truncate(result.stdout, MAX_STDOUT),
        stderr: truncate(result.stderr, MAX_STDERR)
      };
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
