import { describe, expect, it } from 'vitest';
import { classifyTool, isShellTool, parseMcpToolName } from '../tools';

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
    expect(classifyTool('FrobnicateWidget', { explicitKind: 'builtin' }).kind).toBe('builtin');
  });

  it('parses MCP names', () => {
    expect(classifyTool('mcp__github__create_issue')).toEqual({
      name: 'mcp__github__create_issue',
      kind: 'mcp',
      class: 'mcp',
      mcp: { server: 'github', tool: 'create_issue' }
    });
  });

  it('prefers explicit MCP hints', () => {
    expect(classifyTool('search', { mcpServer: 'docs' })).toMatchObject({
      kind: 'mcp',
      mcp: { server: 'docs', tool: 'search' }
    });
    expect(classifyTool('x', { mcpServer: 'docs', mcpTool: 'lookup' }).mcp).toEqual({
      server: 'docs',
      tool: 'lookup'
    });
  });

  it('marks explicit mcp kind without a parsed server', () => {
    let tool = classifyTool('custom', { explicitKind: 'mcp' });

    expect(tool).toEqual({ name: 'custom', kind: 'mcp', class: 'mcp' });
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
