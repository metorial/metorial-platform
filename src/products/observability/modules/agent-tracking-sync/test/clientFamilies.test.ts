import { describe, expect, it } from 'vitest';
import {
  clientFamilyName,
  fromServiceFamily,
  toServiceFamily
} from '../src/definitions/clientFamilies';

describe('client families', () => {
  it('names the families Agent Usage shows by their product names', () => {
    expect(clientFamilyName('claude_code')).toBe('Claude Code');
    expect(clientFamilyName('codex')).toBe('Codex');
    expect(clientFamilyName('cursor')).toBe('Cursor');
    expect(clientFamilyName('antigravity')).toBe('Antigravity');
    expect(clientFamilyName('copilot')).toBe('GitHub Copilot');
    expect(clientFamilyName('opencode')).toBe('OpenCode');
  });

  it('names other families by their agent id in the registry, never by an alias', () => {
    expect(clientFamilyName('kiro')).toBe('Kiro');
    expect(clientFamilyName('cursor-agent')).toBeNull();
    expect(clientFamilyName('not-a-client')).toBeNull();
    expect(clientFamilyName('constructor')).toBeNull();
  });

  it('maps Claude Code between the dashboard and service names', () => {
    expect(toServiceFamily('claude_code')).toBe('claude-code');
    expect(fromServiceFamily('claude-code')).toBe('claude_code');
    expect(toServiceFamily('codex')).toBe('codex');
  });
});
