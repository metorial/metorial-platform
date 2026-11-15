#!/usr/bin/env bun
import { CliError, run } from './cli';
import { Interrupted } from './process';

try {
  await run();
} catch (error) {
  if (error instanceof Interrupted) process.exitCode = 130;
  else {
    let messages: string[] = [];
    let current: unknown = error;

    while (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    }
    console.error(`control: ${messages.join(': ') || String(error)}`);
    process.exitCode = error instanceof CliError ? 2 : 1;
  }
}
