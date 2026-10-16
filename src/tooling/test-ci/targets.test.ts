import { expect, test } from 'bun:test';
import { executableTargets, taskWorkspaceClosure } from './targets';

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

test('reuses the discovered graph without importing phantom task dependencies', () => {
  let tasks = [
    {
      taskId: 'backend#test',
      task: 'test',
      package: 'backend',
      directory: 'apps/backend',
      dependencies: ['util#build', 'db#prisma:generate']
    },
    {
      taskId: 'util#build',
      task: 'build',
      package: 'util',
      directory: 'packages/util',
      dependencies: []
    },
    {
      taskId: 'db#prisma:generate',
      task: 'prisma:generate',
      package: 'db',
      directory: 'packages/db',
      dependencies: []
    },
    {
      taskId: 'frontend#test',
      task: 'test',
      package: 'frontend',
      directory: 'apps/frontend',
      dependencies: ['frontend#build']
    },
    {
      taskId: 'frontend#build',
      task: 'build',
      package: 'frontend',
      directory: 'apps/frontend',
      dependencies: []
    }
  ];
  expect(taskWorkspaceClosure({ names: ['test'], targets: ['backend'], tasks })).toEqual({
    backend: 'apps/backend',
    util: 'packages/util',
    db: 'packages/db'
  });
  expect(() =>
    taskWorkspaceClosure({ names: ['test'], targets: ['backend'], tasks: tasks.slice(0, 1) })
  ).toThrow('Missing Turbo task');
});
