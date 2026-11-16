import { describe, expect, it } from 'vitest';
import { computeShape, fileExtension, languageOf, shellShape } from '../src/shape';

describe('fileExtension', () => {
  it.each([
    ['a/b/c.ts', 'ts'],
    ['C.TSX', 'tsx'],
    ['archive.tar.gz', 'gz'],
    ['.gitignore', ''],
    ['dir/.env', ''],
    ['trailing.', ''],
    ['noext', ''],
    ['', ''],
    ['a.b/c', '']
  ])('%j -> %j', (path, expected) => {
    expect(fileExtension(path)).toBe(expected);
  });

  it('clips very long extensions', () => {
    expect(fileExtension('x.' + 'a'.repeat(100))).toHaveLength(16);
  });
});

describe('languageOf', () => {
  it('maps known extensions', () => {
    expect(languageOf('ts')).toBe('typescript');
    expect(languageOf('py')).toBe('python');
    expect(languageOf('yml')).toBe('yaml');
  });

  it('returns null for unknown or prototype names', () => {
    expect(languageOf('zzz')).toBeNull();
    expect(languageOf('')).toBeNull();
  });
});

describe('shellShape', () => {
  it('extracts programs and flags', () => {
    expect(shellShape('ls -la /tmp')).toEqual({ programs: ['ls'], flags: ['-la'] });
  });

  it('uses the basename of the program path', () => {
    expect(shellShape('/usr/bin/git status').programs).toEqual(['git']);
  });

  it('starts a new segment at pipes, semicolons and ampersands', () => {
    expect(shellShape('cat f | grep -i x; rm -rf y && echo done')).toEqual({
      programs: ['cat', 'grep', 'rm', 'echo'],
      flags: ['-i', '-rf']
    });
  });

  it('skips prefixes and environment assignments', () => {
    expect(shellShape('sudo env FOO=bar time npm test --silent').programs).toEqual(['npm']);
    expect(shellShape('A=1 B=2 node x.js').programs).toEqual(['node']);
  });

  it('keeps only the flag name before an equals sign', () => {
    expect(shellShape('curl --header=Authorization:abc url').flags).toEqual(['--header']);
  });

  it('honors quotes so quoted flags are not extracted', () => {
    expect(shellShape(`echo "-not a flag" '--nope'`)).toEqual({
      programs: ['echo'],
      flags: []
    });
  });

  it('does not treat redirection ampersands as separators', () => {
    expect(shellShape('make 2>&1 | tee log').programs).toEqual(['make', 'tee']);
  });

  it('never captures argument values', () => {
    let { programs, flags } = shellShape('git commit -m "SECRET message" SECRETFILE');

    expect(JSON.stringify({ programs, flags })).not.toContain('SECRET');
  });

  it('caps programs and flags', () => {
    let many = Array.from({ length: 200 }, (_, i) => `p${i} -f${i}`).join(' ; ');
    let { programs, flags } = shellShape(many);

    expect(programs).toHaveLength(32);
    expect(flags).toHaveLength(64);
  });

  it('clips long program names', () => {
    expect(shellShape('a'.repeat(500))?.programs[0]).toHaveLength(64);
  });

  it('only scans the leading 16 KiB', () => {
    let { programs } = shellShape('ls ' + ' '.repeat(20_000) + '; tail-of-input');

    expect(programs).toEqual(['ls']);
  });

  it('handles empty input and unterminated quotes', () => {
    expect(shellShape('')).toEqual({ programs: [], flags: [] });
    expect(shellShape('echo "unterminated -x')).toEqual({ programs: ['echo'], flags: [] });
  });

  it('treats a lone dash as an argument', () => {
    expect(shellShape('cat -').flags).toEqual([]);
  });
});

describe('computeShape', () => {
  it('shapes prompts and responses', () => {
    let text = 'line one\nsee https://a.example and http://b.example\n```ts\nx\n```\n';

    expect(computeShape('prompt', text)).toEqual({ v: 1, lines: 5, code_blocks: 1, urls: 2 });
    expect(computeShape('response', '')).toEqual({ v: 1, lines: 0, code_blocks: 0, urls: 0 });
  });

  it('does not count a trailing newline as a line', () => {
    expect(computeShape('prompt', 'a\n')).toMatchObject({ lines: 1 });
    expect(computeShape('prompt', 'a\n\n')).toMatchObject({ lines: 2 });
  });

  it('ignores an unmatched code fence', () => {
    expect(computeShape('prompt', '```ts\ncode')).toMatchObject({ code_blocks: 0 });
  });

  it('shapes tool input objects by key, type and size only', () => {
    let shape = computeShape('tool_input', '{}', {
      tool: 'Write',
      input: {
        file_path: '/repo/a.ts',
        content: 'hello',
        flags: [1, 2],
        opts: { a: 1 },
        n: 3,
        z: null
      }
    });

    expect(shape).toEqual({
      v: 1,
      tool: 'Write',
      args: [
        { key: 'file_path', type: 'string', size: 10 },
        { key: 'content', type: 'string', size: 5 },
        { key: 'flags', type: 'array', size: 2 },
        { key: 'opts', type: 'object', size: 1 },
        { key: 'n', type: 'number', size: 0 },
        { key: 'z', type: 'null', size: 0 }
      ],
      paths: [{ ext: 'ts', language: 'typescript' }]
    });
  });

  it('adds shell programs and flags for shell tools only', () => {
    let shell = computeShape('tool_input', '', {
      tool: 'Bash',
      input: { command: 'rm -rf build && ls' }
    });
    let other = computeShape('tool_input', '', {
      tool: 'Write',
      input: { command: 'rm -rf build && ls' }
    });

    expect(shell).toMatchObject({ programs: ['rm', 'ls'], flags: ['-rf'] });
    expect(other).not.toHaveProperty('programs');
  });

  it('joins array commands for shell tools', () => {
    let shape = computeShape('tool_input', '', {
      tool: 'exec_command',
      input: { cmd: ['git', 'push', '--force'] }
    });

    expect(shape).toMatchObject({ programs: ['git'], flags: ['--force'] });
  });

  it('treats a string input as a single command argument', () => {
    let shape = computeShape('tool_input', '', { tool: 'bash', input: 'echo hi' });

    expect(shape).toMatchObject({
      args: [{ key: '_', type: 'string', size: 7 }],
      programs: ['echo']
    });
  });

  it('survives missing, array and primitive inputs', () => {
    for (let input of [undefined, null, [1, 2], 5, true]) {
      expect(computeShape('tool_input', '', { tool: 'x', input })).toMatchObject({
        v: 1,
        tool: 'x',
        args: []
      });
    }
  });

  it('caps arguments and clips key names', () => {
    let input: Record<string, number> = {};
    for (let i = 0; i < 100; i++) input[`k${i}`] = i;
    input['k'.repeat(200)] = 1;

    let shape = computeShape('tool_input', '', { tool: 't', input });

    expect((shape?.['args'] as unknown[]).length).toBe(32);
  });

  it('caps path entries', () => {
    let input: Record<string, string> = {};
    let keys = ['file_path', 'path', 'notebook_path', 'filepath', 'filename', 'file'];
    for (let key of keys) input[key] = `/x/${key}.py`;

    let shape = computeShape('tool_input', '', { tool: 't', input });

    expect((shape?.['paths'] as unknown[]).length).toBe(6);
  });

  it('uses unknown for a missing tool name', () => {
    expect(computeShape('tool_input', '', { input: {} })).toMatchObject({ tool: 'unknown' });
  });

  it('shapes tool output', () => {
    expect(computeShape('tool_output', 'ab\ncd\n')).toEqual({
      v: 1,
      lines: 2,
      bytes: 6,
      truncated: false
    });

    expect(
      computeShape('tool_output', 'é', { exitCode: 2, errorClass: 'tool', truncated: true })
    ).toEqual({
      v: 1,
      lines: 1,
      bytes: 2,
      truncated: true,
      exit_code: 2,
      error_class: 'tool'
    });
  });

  it('keeps an exit code of zero', () => {
    expect(computeShape('tool_output', 'x', { exitCode: 0 })).toMatchObject({ exit_code: 0 });
  });

  it('shapes paths', () => {
    expect(computeShape('path', '/a/b/c.rs')).toEqual({
      v: 1,
      ext: 'rs',
      language: 'rust',
      depth: 3,
      absolute: true
    });

    expect(computeShape('path', 'C:\\x\\y.PY')).toEqual({
      v: 1,
      ext: 'py',
      language: 'python',
      depth: 3,
      absolute: true
    });

    expect(computeShape('path', 'rel/file')).toMatchObject({ absolute: false, ext: '' });
  });

  it('shapes error messages from hints only', () => {
    expect(computeShape('error_message', 'SECRET stack')).toEqual({ v: 1, class: 'unknown' });
    expect(
      computeShape('error_message', 'x', { errorClass: 'rate_limit', errorCode: '429' })
    ).toEqual({ v: 1, class: 'rate_limit', code: '429' });
  });

  it('shapes diffs', () => {
    let diff = [
      '--- a/x',
      '+++ b/x',
      '@@ -1 +1,2 @@',
      '-old',
      '+new',
      '+more',
      ' context',
      '--- a/y',
      '+++ b/y',
      '-gone'
    ].join('\n');

    expect(computeShape('diff', diff)).toEqual({ v: 1, files: 2, added: 2, removed: 2 });
  });

  it.each(['system_prompt', 'raw_request', 'raw_response'] as const)(
    'has no shape for %s',
    role => {
      expect(computeShape(role, 'anything')).toBeUndefined();
    }
  );

  it('clips attacker-controlled hint strings', () => {
    let long = 'x'.repeat(500);

    expect(
      computeShape('error_message', '', { errorClass: long, errorCode: long })
    ).toMatchObject({ class: 'x'.repeat(64), code: 'x'.repeat(64) });
    expect(computeShape('tool_input', '', { tool: long, input: {} })).toMatchObject({
      tool: 'x'.repeat(64)
    });
  });
});

describe('computeShape with JSON-string tool input', () => {
  let secret = 'SECRET-91b2';

  it('parses stringified objects so programs come from the command field', () => {
    let input = JSON.stringify({ command: ['bash', '-lc', `cat ${secret}`], timeout: 5 });
    let shape = computeShape('tool_input', input, { tool: 'Bash', input });

    expect(shape).toMatchObject({
      programs: ['bash'],
      args: [
        { key: 'command', type: 'array' },
        { key: 'timeout', type: 'number' }
      ]
    });
    expect(JSON.stringify(shape)).not.toContain(secret);
  });

  it('handles cmd and leading whitespace', () => {
    let input = `  ${JSON.stringify({ cmd: `git push --force ${secret}` })}`;
    let shape = computeShape('tool_input', input, { tool: 'shell', input });

    expect(shape).toMatchObject({ programs: ['git'], flags: ['--force'] });
    expect(JSON.stringify(shape)).not.toContain(secret);
  });

  it('treats malformed JSON-looking strings as opaque', () => {
    let input = `{"command": "cat ${secret}`;
    let shape = computeShape('tool_input', input, { tool: 'Bash', input });

    expect(shape).toMatchObject({ args: [{ key: '_', type: 'string', size: input.length }] });
    expect(shape).not.toHaveProperty('programs');
    expect(JSON.stringify(shape)).not.toContain(secret);
  });

  it('does not parse oversized JSON strings', () => {
    let input = JSON.stringify({ command: `cat ${secret}`, pad: 'x'.repeat(300 * 1024) });
    let shape = computeShape('tool_input', input, { tool: 'Bash', input });

    expect(shape).not.toHaveProperty('programs');
    expect(JSON.stringify(shape)).not.toContain(secret);
  });

  it('still treats plain strings as raw commands', () => {
    let shape = computeShape('tool_input', 'ls -la', { tool: 'Bash', input: 'ls -la' });

    expect(shape).toMatchObject({ programs: ['ls'], flags: ['-la'] });
  });
});
