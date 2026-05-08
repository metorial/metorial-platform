import { describe, expect, it } from 'vitest';
import { createSandbox } from '../src/lib/definitions';

describe('createSandbox', () => {
  it('shares filesystem state between fs and shell providers', async () => {
    let sandbox = await createSandbox();

    await sandbox.fs.writeFile('notes/todo.txt', 'ship sandbox');

    let readFromShell = await sandbox.shell.exec('cat notes/todo.txt');
    expect(readFromShell).toEqual({
      stdout: 'ship sandbox',
      stderr: '',
      exitCode: 0
    });

    let writeFromShell = await sandbox.shell.exec('echo "from bash" > notes/from-bash.txt');
    expect(writeFromShell.exitCode).toBe(0);

    await expect(sandbox.fs.readFile('notes/from-bash.txt')).resolves.toBe('from bash\n');
  });

  it('returns OpenHarness tool objects backed by the sandbox providers', async () => {
    let sandbox = await createSandbox();

    expect(sandbox.tools.readFile).toBeDefined();
    expect(sandbox.tools.writeFile).toBeDefined();
    expect(sandbox.tools.listFiles).toBeDefined();
    expect(sandbox.tools.grep).toBeDefined();
    expect(sandbox.tools.deleteFile).toBeDefined();
    expect(sandbox.tools.bash).toBeDefined();
  });
});
