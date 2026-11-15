import { describe, expect, it } from 'vitest';
import { hintMismatchFindings, type EvidenceTool } from './evidence';

let evidenceTool = (key: string, readOnly: boolean | undefined): EvidenceTool => ({
  key,
  hints: { readOnly }
});

let capability = (key: string, ...tags: any[]) => ({
  key,
  tags,
  behavior: '',
  declaredHints: {},
  hintAccuracy: 'matches' as const
});

describe('hintMismatchFindings', () => {
  it('does not treat reading private data as a write', () => {
    let findings = hintMismatchFindings({
      tools: [evidenceTool('search_messages', true)],
      capabilities: [
        capability('search_messages', 'read', 'untrusted_input', 'bulk_private_data')
      ]
    });

    expect(findings).toEqual([]);
  });

  it('flags a read-only tool that writes', () => {
    let findings = hintMismatchFindings({
      tools: [evidenceTool('send_message', true)],
      capabilities: [capability('send_message', 'write', 'external_send')]
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: 'annotation_mismatch', severity: 'medium' });
  });

  it('flags a read-only tool that deletes as high', () => {
    let findings = hintMismatchFindings({
      tools: [evidenceTool('delete_file', true)],
      capabilities: [capability('delete_file', 'write', 'destructive')]
    });

    expect(findings[0]?.severity).toBe('high');
  });

  it('ignores tools that do not declare read-only', () => {
    let findings = hintMismatchFindings({
      tools: [evidenceTool('send_message', undefined)],
      capabilities: [capability('send_message', 'write')]
    });

    expect(findings).toEqual([]);
  });
});
