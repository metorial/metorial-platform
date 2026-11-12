import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

let provider = 'cloudflare-workers-ai';
let tools = 'read,grep,find,ls,edit,write';
let maxOutputTokens = 32_768;

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
}

// pi gets no shell and an environment holding nothing but the Workers AI credentials, so text in
// the evidence that tries to steer it can at worst produce bad decisions, which review rejects.
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
    '--offline',
    '--no-context-files',
    '--no-extensions',
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
    tools,
    '--append-system-prompt',
    run.systemPromptFile,
    '--',
    run.message
  ];

  let log = createWriteStream(run.logFile, { flags: 'a' });
  log.write(
    `\n=== pi ${run.continueSession ? '(continue) ' : ''}${new Date().toISOString()}\n`
  );

  let exitCode = await new Promise<number>(resolve => {
    let child = spawn(run.piBin, args, {
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
        CLOUDFLARE_ACCOUNT_ID: run.credentials.accountId
      }
    });

    let timer = setTimeout(() => child.kill('SIGTERM'), run.timeoutMs);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', err => {
      log.write(`failed to start pi: ${err.message}\n`);
      clearTimeout(timer);
      resolve(-1);
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve(code ?? -1);
    });
  });

  await new Promise(resolve => log.end(resolve));
  return exitCode;
};
