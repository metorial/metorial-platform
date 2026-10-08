import { expect, test } from 'bun:test';
import { executableTargets } from './targets';

test('prunes only executable targets, retaining explicit prerequisites without selecting phantom frontend tasks', () => {
  expect(
    executableTargets({
      names: ['test', 'prisma:generate'],
      tasks: [
        { package: 'backend', task: 'test', command: 'vitest run' },
        { package: 'frontend', task: 'test', command: '<NONEXISTENT>' },
        { package: 'frontend', task: 'build', command: 'vite build' },
        { package: 'db', task: 'prisma:generate', command: 'prisma generate' },
        { package: 'backend', task: 'prisma:generate', command: 'prisma generate' }
      ]
    })
  ).toEqual(['backend', 'db']);
});
