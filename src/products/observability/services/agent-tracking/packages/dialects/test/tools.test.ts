import { describe, expect, it } from 'vitest';
import {
  classifyTool,
  hasMcpServer,
  isMcpTool,
  isShellTool,
  parseMcpToolName
} from '../src/tools';

describe('parseMcpToolName', () => {
  it('splits server and tool on the first double underscore', () => {
    expect(parseMcpToolName('mcp__github__create_issue')).toEqual({
      server: 'github',
      tool: 'create_issue'
    });
    expect(parseMcpToolName('mcp__a__b__c')).toEqual({ server: 'a', tool: 'b__c' });
  });

  it.each(['Bash', 'mcp_github_x', 'mcp__', 'mcp____x', 'mcp__server', 'mcp__server__', ''])(
    'rejects %j',
    name => {
      expect(parseMcpToolName(name)).toBeNull();
    }
  );
});

describe('classifyTool', () => {
  it.each([
    ['Bash', 'shell', 'shell'],
    ['PowerShell', 'shell', 'shell'],
    ['exec_command', 'shell', 'shell'],
    ['local_shell', 'shell', 'shell'],
    ['Task', 'agent', 'agent'],
    ['spawn_agent', 'agent', 'agent'],
    ['Read', 'builtin', 'file_read'],
    ['Write', 'builtin', 'file_write'],
    ['Edit', 'builtin', 'file_edit'],
    ['MultiEdit', 'builtin', 'file_edit'],
    ['apply_patch', 'builtin', 'file_edit'],
    ['Grep', 'builtin', 'search'],
    ['Glob', 'builtin', 'search'],
    ['WebFetch', 'builtin', 'web'],
    ['web_search', 'builtin', 'web']
  ])('classifies %s', (name, kind, toolClass) => {
    expect(classifyTool(name)).toEqual({ name, kind, class: toolClass });
  });

  it('is case insensitive for the class but keeps the name', () => {
    expect(classifyTool('BASH')).toEqual({ name: 'BASH', kind: 'shell', class: 'shell' });
  });

  it('classifies unknown tools as other', () => {
    expect(classifyTool('FrobnicateWidget')).toEqual({
      name: 'FrobnicateWidget',
      kind: 'unknown',
      class: 'other'
    });
  });

  it('parses MCP names', () => {
    expect(classifyTool('mcp__github__create_issue')).toEqual({
      name: 'mcp__github__create_issue',
      kind: 'mcp',
      class: 'mcp',
      mcp: { server: 'github', tool: 'create_issue' }
    });
  });

  it('prefers a reported MCP server', () => {
    expect(classifyTool('search', { server: 'docs' })).toMatchObject({
      kind: 'mcp',
      mcp: { server: 'docs', tool: 'search' }
    });
    expect(classifyTool('x', { server: 'docs', mcpTool: 'lookup' }).mcp).toEqual({
      server: 'docs',
      tool: 'lookup'
    });
  });

  it.each([
    ['custom', { namespace: 'mcp' }],
    ['custom', { source: 'mcp' }],
    ['custom', { server: { name: 3 } }],
    ['lookup', { server: 'custom', client: 'claude-code' }],
    ['mcp_tool', {}],
    ['mcp_other', {}],
    ['mcp__docs', {}],
    ['mcp__docs__', {}]
  ])('marks %s with %j as an MCP tool without a server', (name, hints) => {
    expect(classifyTool(name, hints)).toEqual({ name, kind: 'mcp', class: 'mcp' });
  });

  it('keeps a server named custom for clients other than Claude Code', () => {
    expect(classifyTool('lookup', { server: 'custom', client: 'codex' }).mcp).toEqual({
      server: 'custom',
      tool: 'lookup'
    });
  });

  it.each([
    ['docs__lookup', { server: 'docs', tool: 'lookup' }],
    ['docs__look__up', { server: 'docs', tool: 'look__up' }]
  ])('splits %s at the first double underscore into server and tool', (name, mcp) => {
    expect(classifyTool(name)).toEqual({ name, kind: 'mcp', class: 'mcp', mcp });
  });

  it.each(['__proto__', 'foo__', '__bar'])('does not classify %s as an MCP tool', name => {
    expect(classifyTool(name).kind).not.toBe('mcp');
  });

  it('strips control characters and bounds length', () => {
    expect(classifyTool('Ba\u0000sh\n').name).toBe('Bash');
    expect(classifyTool('x'.repeat(500)).name).toHaveLength(128);
    expect(classifyTool('   ').name).toBe('unknown');
    expect(classifyTool('').name).toBe('unknown');
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'])(
    'treats the object property name %s as an ordinary unknown tool',
    name => {
      let tool = classifyTool(name);

      expect(tool.kind).toBe('unknown');
      expect(tool.class).toBe('other');
    }
  );
});

describe('isMcpTool', () => {
  it.each([
    [{ name: 'mcp__docs__lookup' }, true],
    [{ name: 'docs__lookup' }, true],
    [{ name: 'mcp_tool' }, true],
    [{ name: 'Bash', server: 'docs' }, true],
    [{ name: 'Bash', server: '' }, false],
    [{ name: 'Bash', server: { name: 'docs' } }, true],
    [{ name: 'Bash', namespace: 'mcp__docs__' }, true],
    [{ name: 'Bash', source: 'mcp' }, true],
    [{ name: 'Bash' }, false],
    [{ name: 'Bash', server: {} }, false],
    [{ name: 'my_tool', namespace: 'functions' }, false],
    [{}, false]
  ])('reads %j as MCP: %s', (signals, expected) => {
    expect(isMcpTool(signals)).toBe(expected);
  });

  it('treats a non-empty name or object as a reported server', () => {
    expect(hasMcpServer('docs')).toBe(true);
    expect(hasMcpServer('')).toBe(false);
    expect(hasMcpServer({ name: 'docs' })).toBe(true);
    expect(hasMcpServer({})).toBe(false);
    expect(hasMcpServer(null)).toBe(false);
    expect(hasMcpServer(['docs'])).toBe(false);
  });
});

describe('isShellTool', () => {
  it('recognizes shell tools case-insensitively', () => {
    expect(isShellTool('Bash')).toBe(true);
    expect(isShellTool('exec_command')).toBe(true);
    expect(isShellTool('Read')).toBe(false);
    expect(isShellTool(undefined)).toBe(false);
    expect(isShellTool('')).toBe(false);
    expect(isShellTool('constructor')).toBe(false);
  });
});
