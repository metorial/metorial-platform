import { describe, expect, it } from 'vitest';
import { clientAdapter } from './adapter';

describe('clientAdapter', () => {
  it('rejects queued messages when the transport returns too few responses', async () => {
    let adapter = clientAdapter(async () => []);

    await expect(adapter.discover()).rejects.toThrow(
      'MCP adapter transport returned 0 responses for 1 messages'
    );
  });
});
