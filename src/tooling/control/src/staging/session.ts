import { existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { findControlRoot, resolveEntrypoint, resolveOssRoot, resolveControlCwd } from '../entrypoint';
import type { WorkspaceSession } from '../types';
import { copyGitAwareTree, mapPathToStaged } from './copyTree';

// Builds and tests run against an isolated copy at {repoRoot}/.control/temp-src/{timestamp}/.
// The live checkout is only used to launch control itself; Docker contexts and unit-test cwd
// resolve into the staged tree. Use --no-stage or CONTROL_NO_STAGE=1 to opt out.

export type { WorkspaceSession };

let activeSession: WorkspaceSession | null = null;

export let getActiveSession = (): WorkspaceSession | null => activeSession;

export let resolveStagedEntrypoint = (session: WorkspaceSession, entrypoint?: string): string => {
  let real = resolveEntrypoint({ cwd: resolveControlCwd(), entrypoint });
  return mapPathToStaged({
    repoRoot: session.repoRoot,
    stagedRoot: session.stagedEntrypoint,
    sourcePath: real
  });
};

export let isStagingEnabled = (opts?: { noStage?: boolean }): boolean => {
  if (opts?.noStage) return false;
  if (process.env.CONTROL_NO_STAGE === '1') return false;
  return true;
};

export let createWorkspaceSession = async (opts: {
  entrypoint?: string;
  verbose?: boolean;
}): Promise<WorkspaceSession> => {
  if (activeSession) return activeSession;

  let cwd = resolveControlCwd();
  let repoRoot = findControlRoot(cwd);
  let realEntrypoint = resolveEntrypoint({ cwd, entrypoint: opts.entrypoint });
  let id = `${Date.now()}`;
  let stagedEntrypoint = join(repoRoot, '.control', 'temp-src', id);

  await copyGitAwareTree({
    sourceRoot: repoRoot,
    destRoot: stagedEntrypoint,
    verbose: opts.verbose
  });

  if (!existsSync(stagedEntrypoint)) {
    throw new Error(`Failed to create staged workspace at ${stagedEntrypoint}`);
  }

  let stagedOssRoot = resolveOssRoot(stagedEntrypoint);

  activeSession = {
    id,
    repoRoot,
    realEntrypoint,
    stagedEntrypoint,
    stagedOssRoot
  };

  if (opts.verbose) {
    console.error(`[control:stage] Session ${id}`);
    console.error(`[control:stage]   repo root: ${repoRoot}`);
    console.error(`[control:stage]   staged at: ${stagedEntrypoint}`);
    console.error(`[control:stage]   staged oss: ${stagedOssRoot}`);
  }

  return activeSession;
};

export let destroyWorkspaceSession = async (opts?: { keep?: boolean }) => {
  if (!activeSession) return;

  let session = activeSession;
  activeSession = null;

  if (opts?.keep) {
    console.error(`[control:stage] Keeping staged workspace at ${session.stagedEntrypoint}`);
    return;
  }

  if (existsSync(session.stagedEntrypoint)) {
    rmSync(session.stagedEntrypoint, { recursive: true, force: true });
  }
};

export let withWorkspaceSession = async <T>(
  opts: {
    entrypoint?: string;
    verbose?: boolean;
    keep?: boolean;
    noStage?: boolean;
  },
  fn: (session: WorkspaceSession | null) => Promise<T>
): Promise<T> => {
  if (!isStagingEnabled(opts)) {
    return fn(null);
  }

  let session = await createWorkspaceSession({
    entrypoint: opts.entrypoint,
    verbose: opts.verbose
  });

  try {
    return await fn(session);
  } finally {
    await destroyWorkspaceSession({ keep: opts.keep });
  }
};
