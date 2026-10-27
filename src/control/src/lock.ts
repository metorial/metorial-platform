import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import { dlopen, FFIType } from 'bun:ffi';
import { delay, Interrupted } from './process';

let native =
  process.platform === 'win32'
    ? undefined
    : dlopen(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6', {
        flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 }
      });

export let acquireLock = async (path: string, onWait?: () => void): Promise<() => void> => {
  mkdirSync(dirname(path), { recursive: true });

  if (!native) return acquireWindowsLock(path, onWait);

  let descriptor = openSync(path, 'a+');
  let interrupted = false;
  let interrupt = () => {
    interrupted = true;
  };
  process.on('SIGINT', interrupt);

  process.on('SIGTERM', interrupt);

  let announced = false;

  try {
    while (native.symbols.flock(descriptor, 6) !== 0) {
      if (interrupted) throw new Interrupted();

      if (!announced) {
        onWait?.();
        announced = true;
      }

      await delay(100);
    }

    return () => {
      native!.symbols.flock(descriptor, 8);
      closeSync(descriptor);
    };
  } catch (error) {
    closeSync(descriptor);
    throw error;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
};

export let withLock = async <T>(path: string, action: () => T | Promise<T>): Promise<T> => {
  let release = await acquireLock(path);

  try {
    return await action();
  } finally {
    release();
  }
};

let acquireWindowsLock = (path: string, onWait?: () => void): Promise<() => void> =>
  new Promise((resolve, reject) => {
    let script = `$ErrorActionPreference = 'Stop'; $file = [System.IO.File]::Open($env:CONTROL_LOCK_PATH, 'OpenOrCreate', 'ReadWrite', 'ReadWrite'); try { while ($true) { try { $file.Lock(0, [long]::MaxValue); break } catch [System.IO.IOException] { [Console]::Out.WriteLine('waiting'); Start-Sleep -Milliseconds 100 } }; [Console]::Out.WriteLine('locked'); [Console]::In.ReadLine() | Out-Null; $file.Unlock(0, [long]::MaxValue) } finally { $file.Dispose() }`;
    let child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        env: { ...process.env, CONTROL_LOCK_PATH: path },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      }
    );
    let acquired = false;
    let announced = false;

    let errors = '';
    let buffer = '';
    let interrupt = () => {
      child.kill();
      reject(new Interrupted());
    };
    let cleanup = () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
    };

    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    child.stderr.on('data', chunk => {
      errors += chunk;
    });
    child.stdout.on('data', chunk => {
      buffer += chunk;

      while (buffer.includes('\n')) {
        let index = buffer.indexOf('\n');
        let line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);

        if (line === 'waiting' && !announced) {
          announced = true;
          onWait?.();
        }

        if (line === 'locked' && !acquired) {
          acquired = true;
          cleanup();
          resolve(() => child.stdin.end('release\n'));
        }
      }
    });

    child.once('error', error => {
      cleanup();
      reject(error);
    });
    child.once('exit', code => {
      cleanup();

      if (!acquired) reject(new Error(`could not acquire file lock: ${errors || code}`));
    });
  });
