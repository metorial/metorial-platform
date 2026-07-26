import { describe, expect, test } from 'vitest';
import {
  extractMessageIdsFromHeader,
  getIncomingEmailHash,
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
    expect(parsed.html).toContain('<strong>team</strong>');
  });

  test('extracts message ids and normalizes thread subjects', () => {
    expect(extractMessageIdsFromHeader('<one@example.com> <two@example.com>')).toEqual([
      'one@example.com',
      'two@example.com'
    ]);
    expect(normalizeThreadSubject('Re: Fwd: Hello')).toBe('Hello');
  });

  test('creates deterministic hashes for messages without Message-ID', async () => {
    let first = await getIncomingEmailHash('same raw message');
    let second = await getIncomingEmailHash('same raw message');

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test('parses inbound attachment content and metadata', async () => {
    let parsed = await parseIncomingEmail(`From: Alice <alice@example.com>
To: Relay <inbox@example.com>
Subject: Attachment
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary=relay

--relay
Content-Type: text/plain

See attached
--relay
Content-Type: text/plain; name=hello.txt
Content-Disposition: attachment; filename=hello.txt
Content-Transfer-Encoding: base64

aGVsbG8=
--relay--`);

    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toMatchObject({
      filename: 'hello.txt',
      contentType: 'text/plain',
      size: 5
    });
    expect(new TextDecoder().decode(parsed.attachments[0]!.content)).toBe('hello');
  });
});
