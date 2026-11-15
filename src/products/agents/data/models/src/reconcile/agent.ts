import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEventReader } from './agentEvents';
import { formatDuration, type Log } from './log';
import { sandboxCommand } from './sandbox';

let provider = 'cloudflare-workers-ai';
let tools = 'read,grep,find,ls';
let maxOutputTokens = 32_768;
let heartbeatMs = 30_000;

export interface AgentCredentials {
  apiToken: string;
  accountId: string;
}

export interface AgentRun {
  piBin: string;
  model: string;
  thinking: string;
  cwd: string;
  workDir: string;
  systemPromptFile: string;
  message: string;
  continueSession: boolean;
  credentials: AgentCredentials;
  timeoutMs: number;
  logFile: string;
  log: Log;
  label: string;
  writableDirectory?: string;
}

export let runAgent = async (run: AgentRun) => {
  let home = path.join(run.workDir, 'pi-home');
  await mkdir(home, { recursive: true });

  // pi asks for the model's whole output window by default, which Workers AI rejects once the
  // prompt is added to it.
  await writeFile(
    path.join(home, 'models.json'),
    JSON.stringify({
      providers: {
        [provider]: { modelOverrides: { [run.model]: { maxTokens: maxOutputTokens } } }
      }
    })
  );

  let args = [
    '--print',
    '--mode',
    'json',
    '--offline',
    '--no-context-files',
    '--no-extensions',
    ...(run.writableDirectory
      ? ['--extension', path.join(import.meta.dirname, 'sourceTools.ts')]
      : []),
    '--no-mcp',
    '--no-skills',
    '--no-prompt-templates',
    '--no-themes',
    '--no-approve',
    '--session-dir',
    path.join(run.workDir, 'sessions'),
    ...(run.continueSession ? ['--continue'] : []),
    '--provider',
    provider,
    '--model',
    run.model,
    '--thinking',
    run.thinking,
    '--tools',
    run.writableDirectory ? `${tools},edit,write,test` : tools,
    '--append-system-prompt',
    run.systemPromptFile,
    '--',
    run.message
  ];

  let file = createWriteStream(run.logFile, { flags: 'a' });
  let startedAt = Date.now();
  let log: Log = message => run.log(`${run.label}: ${message}`);

  file.write(
    `\n=== pi ${run.continueSession ? '(continue) ' : ''}${new Date().toISOString()}\n`
  );
  log(run.continueSession ? 'continuing the session' : 'starting pi');

  let answer = '';
  let testCalls = 0;
  let reader = createEventReader({
    log,
    transcript: text => file.write(`\n--- ${text}\n`),
    onAnswer: text => {
      answer = text;
    }
  });

  let command = run.writableDirectory
    ? await sandboxCommand({
        command: run.piBin,
        args,
        writable: [run.writableDirectory, run.workDir],
        scratch: path.join(run.workDir, 'tmp')
      })
    : { command: run.piBin, args, env: {} };
  let exitCode = await new Promise<number>(resolve => {
    let child = spawn(command.command, command.args, {
      cwd: run.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH ?? '',
        HOME: home,
        PI_CODING_AGENT_DIR: home,
        PI_OFFLINE: '1',
        PI_SKIP_VERSION_CHECK: '1',
        PI_TELEMETRY: '0',
        NO_COLOR: '1',
        TERM: 'dumb',
        CLOUDFLARE_API_KEY: run.credentials.apiToken,
        CLOUDFLARE_ACCOUNT_ID: run.credentials.accountId,
        ...command.env,
        ...(run.writableDirectory
          ? {
              MODEL_CATALOG_SOURCE_DIR: run.writableDirectory,
              MODEL_CATALOG_PACKAGE_DIR: run.cwd
            }
          : {})
      }
    });

    let finished = false;
    let timedOut = false;
    let timer = setTimeout(() => {
      timedOut = true;
      log(`timed out after ${formatDuration(run.timeoutMs)}, stopping pi`);
      child.kill('SIGTERM');
    }, run.timeoutMs);
    let heartbeat = setInterval(() => log(reader.heartbeat()), heartbeatMs);

    let lines = (stream: NodeJS.ReadableStream) => {
      let pending = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        pending += chunk;
        let parts = pending.split('\n');
        pending = parts.pop() ?? '';
        for (let part of parts) {
          try {
            let event = JSON.parse(part);
            if (
              event.type === 'tool_execution_start' &&
              event.toolName === 'test' &&
              ['provider', 'all'].includes(event.args?.suite)
            )
              testCalls++;
          } catch {}
          reader.push(part);
        }
      });
      stream.on('end', () => reader.push(pending));
    };
    lines(child.stdout);
    lines(child.stderr);

    let finish = (code: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      resolve(timedOut && code === 0 ? -1 : code);
    };

    child.on('error', err => {
      log(`failed to start pi: ${err.message}`);
      file.write(`failed to start pi: ${err.message}\n`);
      finish(-1);
    });
    child.on('close', code => finish(code ?? -1));
  });

  await new Promise(resolve => file.end(resolve));
  log(`finished with exit code ${exitCode} after ${formatDuration(Date.now() - startedAt)}`);

  return { exitCode, stats: reader.stats, answer, testCalls };
};
