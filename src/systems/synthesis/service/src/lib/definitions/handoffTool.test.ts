import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getHandoffToolMetadata, handoffTool } from './handoffTool';

describe('handoffTool', () => {
  it('creates a schema-only tool with client handoff metadata', () => {
    let question = handoffTool({
      title: 'Question',
      description: 'Ask the client a question',
      inputSchema: z.object({
        question: z.string()
      })
    });

    expect(getHandoffToolMetadata(question)).toEqual({
      title: 'Question',
      description: 'Ask the client a question'
    });
    expect((question as any).execute).toBeUndefined();
  });
});
