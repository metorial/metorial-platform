import { describe, expect, it } from 'vitest';
import { isListResult, isToolCallMessage, shouldScanMessage } from './messageScope';

let SKIPPED_METHODS = [
  'initialize',
  'ping',
  'tools/list',
  'prompts/list',
  'resources/list',
  'resources/templates/list',
  'completion/complete',
  'logging/setLevel'
];

let mcpInput = (method: string) => ({ type: 'mcp', data: { method, params: {} } });

let mcpOutput = (result: unknown) => ({ type: 'mcp', data: { result } });

describe('shouldScanMessage', () => {
  it.each(SKIPPED_METHODS)('skips %s by method name', method => {
    expect(shouldScanMessage({ methodOrToolKey: method, hasTool: false })).toBe(false);
  });

  it.each(SKIPPED_METHODS)('skips %s by the MCP input method', method => {
    expect(
      shouldScanMessage({ methodOrToolKey: null, hasTool: false, input: mcpInput(method) })
    ).toBe(false);
  });

  it.each([
    'notifications/initialized',
    'notifications/progress',
    'notifications/tools/list_changed'
  ])('skips %s', method => {
    expect(shouldScanMessage({ methodOrToolKey: method, hasTool: false })).toBe(false);
    expect(
      shouldScanMessage({ methodOrToolKey: null, hasTool: false, input: mcpInput(method) })
    ).toBe(false);
  });

  it('scans tool calls and other content-bearing methods', () => {
    expect(
      shouldScanMessage({
        methodOrToolKey: null,
        hasTool: false,
        input: mcpInput('tools/call')
      })
    ).toBe(true);
    expect(shouldScanMessage({ methodOrToolKey: 'resources/read', hasTool: false })).toBe(
      true
    );
    expect(shouldScanMessage({ methodOrToolKey: 'prompts/get', hasTool: false })).toBe(true);
    expect(shouldScanMessage({ methodOrToolKey: null, hasTool: false })).toBe(true);
  });

  it('lets a known tool win over a control method name', () => {
    expect(shouldScanMessage({ methodOrToolKey: 'ping', hasTool: true })).toBe(true);
    expect(
      shouldScanMessage({
        methodOrToolKey: 'tools/list',
        hasTool: true,
        input: mcpInput('tools/list'),
        output: mcpOutput({ tools: [] })
      })
    ).toBe(true);
  });

  it('skips list-shaped results when the method name was stripped', () => {
    for (let key of ['tools', 'prompts', 'resources', 'resourceTemplates']) {
      expect(
        shouldScanMessage({
          methodOrToolKey: null,
          hasTool: false,
          output: mcpOutput({ [key]: [{ name: 'x' }] })
        })
      ).toBe(false);
    }
  });

  it('scans results that carry content even if they also list things', () => {
    expect(
      shouldScanMessage({
        methodOrToolKey: null,
        hasTool: false,
        output: mcpOutput({ tools: [], content: [{ type: 'text', text: 'hi' }] })
      })
    ).toBe(true);
  });
});

describe('isListResult', () => {
  it('requires an MCP output with an array under a list key', () => {
    expect(isListResult(mcpOutput({ tools: [] }))).toBe(true);
    expect(isListResult(mcpOutput({ tools: 'nope' }))).toBe(false);
    expect(isListResult(mcpOutput({ items: [] }))).toBe(false);
    expect(isListResult(mcpOutput(null))).toBe(false);
    expect(isListResult(mcpOutput('text'))).toBe(false);
    expect(isListResult({ type: 'tool.result', data: { result: { tools: [] } } })).toBe(false);
    expect(isListResult(null)).toBe(false);
    expect(isListResult(undefined)).toBe(false);
  });
});

describe('isToolCallMessage', () => {
  it('detects tool calls from the tool, the input type, or the MCP method', () => {
    expect(isToolCallMessage({ methodOrToolKey: null, hasTool: true })).toBe(true);
    expect(
      isToolCallMessage({
        methodOrToolKey: null,
        hasTool: false,
        input: { type: 'tool.call' }
      })
    ).toBe(true);
    expect(
      isToolCallMessage({
        methodOrToolKey: null,
        hasTool: false,
        input: mcpInput('tools/call')
      })
    ).toBe(true);
    expect(
      isToolCallMessage({
        methodOrToolKey: null,
        hasTool: false,
        input: mcpInput('resources/read')
      })
    ).toBe(false);
    expect(isToolCallMessage({ methodOrToolKey: 'tools/call', hasTool: false })).toBe(false);
  });
});
