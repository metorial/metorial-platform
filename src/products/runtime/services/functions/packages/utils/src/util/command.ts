import { spawn } from 'child_process';

interface CommandOptions {
  env?: Record<string, string>;
  cwd?: string;
}

export let command = async (args: string[], options: CommandOptions = {}): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (args.length === 0) {
      reject(new Error('No command provided'));
      return;
    }

    let command = args[0];
    let commandArgs = args.slice(1);
    let cwd = options.cwd || process.cwd();
    let env = {
      ...process.env,
      ...options.env
    };

    // Print the command being executed
    console.log(`$ ${args.join(' ')}`);

    let child = spawn(command, commandArgs, {
      cwd,
      env,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    child.stdout?.on('data', data => {
      process.stdout.write(data);
    });

    child.stderr?.on('data', data => {
      process.stderr.write(data);
    });

    child.on('error', error => {
      reject(error);
    });

    child.on('close', code => {
      if (code !== 0 && code !== null) {
        console.error(`Exit code: ${code}`);
      }
      resolve(code || 0);
    });
  });
};

export let run = async (
  ...input: [strings: TemplateStringsArray, ...values: any[]] | [command: string]
): Promise<number> => {
  let args = '';

  if (typeof input[0] === 'string') {
    args = input[0];
    return command(parseCommandString(args));
  }

  let [strings, ...values] = input as [TemplateStringsArray, ...any[]];
  for (let i = 0; i < strings.length; i++) {
    args += strings[i];
    if (i < values.length) {
      args += String(values[i]);
    }
  }

  return command(parseCommandString(args));
};

let parseCommandString = (command: string): string[] => {
  let args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    let char = command[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"' || char === "'") {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
        quoteChar = '';
      } else {
        current += char;
      }
      continue;
    }

    if (char === ' ' && !inQuote) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
};
