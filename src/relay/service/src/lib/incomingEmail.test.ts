import { describe, expect, test } from 'vitest';
import {
  extractMessageIdsFromHeader,
  normalizeThreadSubject,
  parseIncomingEmail
} from './incomingEmail';

describe('incoming email parsing', () => {
  test('stores only visible reply text from plain text email', async () => {
    let parsed = await parseIncomingEmail(`From: Alice <alice@example.com>
To: Relay <inbox@example.com>
Subject: Re: Support
Message-ID: <reply-1@example.com>
In-Reply-To: <original@example.com>

Fresh reply

On Jan 1, Bob <bob@example.com> wrote:
> Old text`);

    expect(parsed.from).toBe('alice@example.com');
    expect(parsed.recipients).toContain('inbox@example.com');
    expect(parsed.messageId).toBe('reply-1@example.com');
    expect(parsed.inReplyToIds).toEqual(['original@example.com']);
    expect(parsed.text).toBe('Fresh reply');
  });

  test('converts html-only email to text before postprocessing', async () => {
    let parsed = await parseIncomingEmail(`From: Alice <alice@example.com>
To: Relay <inbox@example.com>
Subject: Hello
Message-ID: <html-1@example.com>
Content-Type: text/html; charset=utf-8

<p>Hello <strong>team</strong></p>`);

    expect(parsed.text).toContain('Hello team');
  });

  test('extracts message ids and normalizes thread subjects', () => {
    expect(extractMessageIdsFromHeader('<one@example.com> <two@example.com>')).toEqual([
      'one@example.com',
      'two@example.com'
    ]);
    expect(normalizeThreadSubject('Re: Fwd: Hello')).toBe('Hello');
  });
});
