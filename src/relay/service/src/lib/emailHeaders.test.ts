import { describe, expect, test } from 'vitest';
import { getReplyHeadersForIncomingEmail } from './emailHeaders';

describe('email reply headers', () => {
  test('builds In-Reply-To and References headers from incoming email metadata', () => {
    let incomingEmail: any = {
      messageId: 'reply-target@example.com',
      headers: [
        ['references', '<first@example.com> <second@example.com>'],
        ['subject', 'Hello']
      ]
    };

    expect(getReplyHeadersForIncomingEmail(incomingEmail)).toEqual({
      inReplyTo: '<reply-target@example.com>',
      references: [
        '<first@example.com>',
        '<second@example.com>',
        '<reply-target@example.com>'
      ]
    });
  });

  test('skips reply headers when the incoming email has no message id', () => {
    expect(getReplyHeadersForIncomingEmail({ messageId: null, headers: [] } as any)).toBe(
      undefined
    );
  });
});
