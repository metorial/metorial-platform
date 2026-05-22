import type { ServiceRegistry } from './types';
import { dim, red } from './log';

export class ControlError extends Error {
  code: string;
  hint?: string;
  details?: string[];
  cause?: Error;

  constructor(opts: {
    code: string;
    message: string;
    hint?: string;
    details?: string[];
    cause?: Error;
  }) {
    super(opts.message);
    this.name = 'ControlError';
    this.code = opts.code;
    this.hint = opts.hint;
    this.details = opts.details;
    this.cause = opts.cause;
  }
}

export class UnknownServiceError extends ControlError {
  constructor(opts: { input: string; known: string[]; suggestion?: string }) {
    let details = [`Known services: ${formatNameList(opts.known)}`];
    if (opts.suggestion) details.unshift(`Did you mean: ${opts.suggestion}`);

    super({
      code: 'unknown_service',
      message: `Unknown control service "${opts.input}"`,
      hint: 'Run `control ls` to list all services',
      details
    });
  }
}

export class NoTestError extends ControlError {
  constructor(opts: { name: string; mode: 'e2e' | 'unit' }) {
    super({
      code: 'no_test',
      message: `Service "${opts.name}" has no ${opts.mode} tests defined`,
      hint: 'Run `control ls` to see which services have e2e/unit tests'
    });
  }
}

export class NotInServiceDirError extends ControlError {
  constructor(opts: { cwd: string; controlRoot: string }) {
    super({
      code: 'not_in_service_dir',
      message: 'Not inside a control-managed service directory',
      hint: 'Specify a target, use --all, or --filter',
      details: [`Current directory: ${opts.cwd}`, `Control root: ${opts.controlRoot}`]
    });
  }
}

export class InvalidFlagsError extends ControlError {
  constructor(message: string, hint?: string) {
    super({ code: 'invalid_flags', message, hint });
  }
}

export class ResolveTargetError extends ControlError {
  constructor(opts: { target: string; candidates: string[] }) {
    super({
      code: 'resolve_target',
      message: `No control.toml found for target "${opts.target}"`,
      hint: 'Run `control ls` to list valid service paths',
      details: opts.candidates.map(c => `Tried: ${c}`)
    });
  }
}

export class DuplicateServiceError extends ControlError {
  constructor(opts: { name: string; existing: string; duplicate: string }) {
    super({
      code: 'duplicate_service',
      message: `Duplicate control service name "${opts.name}"`,
      details: [`Existing: ${opts.existing}`, `Duplicate: ${opts.duplicate}`]
    });
  }
}

export class CircularDependencyError extends ControlError {
  constructor(opts: { services: string[] }) {
    super({
      code: 'circular_dependency',
      message: 'Circular control dependency detected among selected services',
      details: opts.services.length ? [`Involved: ${opts.services.join(', ')}`] : undefined
    });
  }
}

export class DockerError extends ControlError {
  phase?: string;

  constructor(opts: {
    phase: string;
    command: string;
    exitCode: number;
    service?: string;
    composeFile?: string;
    keep?: boolean;
  }) {
    let details = [`Command: ${opts.command}`, `Exit code: ${opts.exitCode}`];
    if (opts.composeFile) details.push(`Compose file: ${opts.composeFile}`);

    super({
      code: 'docker_error',
      message: opts.service
        ? `Docker command failed during ${opts.phase} for ${opts.service}`
        : `Docker command failed during ${opts.phase}`,
      hint: opts.keep
        ? 'Containers were kept running for inspection'
        : 'Re-run with --keep to inspect containers after failure',
      details
    });
    this.phase = opts.phase;
  }
}

export class HealthTimeoutError extends ControlError {
  constructor(opts: { containers: { name: string; status: string }[] }) {
    super({
      code: 'health_timeout',
      message: `Timed out waiting for ${opts.containers.length} container(s) to become healthy`,
      hint: 'Re-run with --keep and check container logs',
      details: opts.containers.map(c => `${c.name}: ${c.status}`)
    });
  }
}

export class EntrypointError extends ControlError {
  constructor(message: string, details?: string[]) {
    super({
      code: 'entrypoint',
      message,
      hint: 'Use --entrypoint to specify the workspace root',
      details
    });
  }
}

export let suggestServiceName = (input: string, known: string[]): string | undefined => {
  let lower = input.toLowerCase();
  let prefix = known.find(n => n.toLowerCase().startsWith(lower));
  if (prefix) return prefix;

  let contains = known.find(n => n.toLowerCase().includes(lower) || lower.includes(n.toLowerCase()));
  if (contains) return contains;

  let best: { name: string; dist: number } | undefined;
  for (let name of known) {
    let dist = levenshtein(lower, name.toLowerCase());
    if (dist <= 3 && (!best || dist < best.dist)) best = { name, dist };
  }
  return best?.name;
};

let levenshtein = (a: string, b: string): number => {
  let matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }
  return matrix[b.length]![a.length]!;
};

export let listServiceNames = (registry: ServiceRegistry): string[] =>
  registry.services.map(s => s.name);

export let formatNameList = (names: string[]): string => {
  if (names.length <= 8) return names.join(', ');
  return names.slice(0, 8).join(', ') + `, ... (+${names.length - 8} more)`;
};

export let formatControlError = (err: unknown, opts?: { verbose?: boolean }): string => {
  let lines: string[] = [];

  if (err instanceof ControlError) {
    lines.push(red(`error: ${err.message}`));
    lines.push('');
    if (err.details?.length) {
      for (let detail of err.details) lines.push(`  ${detail}`);
      lines.push('');
    }
    if (err.hint) lines.push(`hint: ${err.hint}`);
    if (opts?.verbose && err.stack) {
      lines.push('');
      lines.push(dim(err.stack));
    }
    if (opts?.verbose && err.cause?.stack) {
      lines.push('');
      lines.push(dim(`Caused by: ${err.cause.stack}`));
    }
    return lines.join('\n');
  }

  if (err instanceof Error) {
    lines.push(red(`error: ${err.message}`));
    if (opts?.verbose && err.stack) {
      lines.push('');
      lines.push(dim(err.stack));
    }
    return lines.join('\n');
  }

  lines.push(red(`error: ${String(err)}`));
  return lines.join('\n');
};
