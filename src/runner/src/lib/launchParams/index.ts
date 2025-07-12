import { v } from '@metorial/validation';
import { $ } from 'bun';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let fileIndex = 0;

let launchParamsSchema = v.object({
  command: v.string(),
  args: v.optional(v.array(v.string())),
  env: v.optional(v.record(v.string()))
});

export let getLaunchParams = async (d: {
  getLaunchParams: string;
  config: Record<string, any>;
}) => {
  let script = `
let launcherContext = (config) => ({
  args: {
    flags: (input) => {
      if (typeof input !== 'object' || input === null) {
        throw new Error('Invalid input, expected object');
      }

      if (typeof input.separator !== 'string' && input.separator !== undefined) {
        throw new Error('Invalid input.separator, expected string');
      }

      if (typeof input.args !== 'object' || input.args === null) {
        throw new Error('Invalid input.args, expected object');
      }

      let args = (Array.isArray(input.args) ? input.args : Object.entries(input.args))
        .map(arg => {
          let configValue = config[arg[1]];
          if (configValue === undefined || configValue === null || configValue === '')
            return undefined;

          return [arg[0], configValue];
        })
        .filter(Boolean);

      if (input.separator) {
        return args.map(arg => arg.join(input.separator));
      }

      return args.flatMap(arg => arg);
    }
  }
})

let config = ${JSON.stringify(d.config)};

let launcher = eval(${JSON.stringify(d.getLaunchParams)});

let output = typeof launcher == 'function' ? 
  launcher(config, launcherContext(config)) : 
  launcher;

console.log(JSON.stringify({ type: 'success', data: output }));
  `;

  let tempFile = path.join(os.tmpdir(), `metorial-runner-launcher-${++fileIndex}.js`);

  await fs.writeFile(tempFile, script, 'utf-8');

  // determine which timeout command to use based on platform
  let timeoutCmd = '';
  if (process.platform === 'darwin') {
    // macOS: use gtimeout if available, otherwise no timeout
    try {
      await $`which gtimeout`.quiet();
      timeoutCmd = 'gtimeout 5s';
    } catch {
      timeoutCmd = '';
    }
  } else {
    // Linux: use timeout
    timeoutCmd = 'timeout 5s';
  }

  let denoCmd = `deno run --v8-flags=--max-old-space-size=20 --allow-read=${tempFile} --deny-write --deny-env --deny-sys --deny-net --deny-run --deny-ffi ${tempFile}`;
  let fullCmd = timeoutCmd ? `${timeoutCmd} ${denoCmd}` : denoCmd;

  let out = await $`${{ raw: fullCmd }}`.throws(false).quiet();

  let stdout = await new Response(out.stdout).text();
  let stderr = await new Response(out.stderr).text();

  stdout = stdout.replace(tempFile, 'get-launch-params.js');
  stderr = stderr.replace(tempFile, 'get-launch-params.js');

  if (out.exitCode !== 0) {
    return {
      type: 'error' as const,
      output: [stdout, stderr].filter(Boolean).join('\n')
    };
  }

  try {
    let lines = stdout.split('\n').filter(Boolean);
    let data = JSON.parse(lines[lines.length - 1]);

    if (data.type == 'success') {
      let valRes = launchParamsSchema.validate(data.data);
      if (!valRes.success) {
        return {
          type: 'error' as const,
          output: `Invalid output from launcher script: ${valRes.errors
            .map(e => e.message)
            .join(', ')}`
        };
      }

      return {
        type: 'success' as const,
        output: valRes.value
      };
    }
  } catch (e) {}

  return {
    type: 'error' as const,
    output: `Failed to parse output from launcher script: ${stdout}\n${stderr}`.trim()
  };
};
