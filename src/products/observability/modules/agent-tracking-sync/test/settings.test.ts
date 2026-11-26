import { describe, expect, it } from 'vitest';
import {
  isTicketUrlTemplate,
  normalizeTicketUrlTemplate,
  ticketUrlTemplate
} from '../src/lib/settings';

let ofLength = (length: number) => {
  let prefix = 'https://tickets.example.com/';
  let suffix = '/{key}';
  return `${prefix}${'a'.repeat(length - prefix.length - suffix.length)}${suffix}`;
};

describe('isTicketUrlTemplate', () => {
  it.each([
    'https://linear.app/acme/issue/{key}',
    'https://acme.atlassian.net/browse/{key}',
    'http://jira.internal.example.com/browse/{key}',
    'https://tickets.example.com/search?q={key}',
    '  https://linear.app/acme/issue/{key}  '
  ])('accepts %s', template => {
    expect(isTicketUrlTemplate(template)).toBe(true);
  });

  it.each([
    ['without the placeholder', 'https://linear.app/acme/issue'],
    ['a javascript URL', 'javascript:alert(1)//{key}'],
    ['a data URL', 'data:text/html,{key}'],
    ['another scheme', 'ftp://tickets.example.com/{key}'],
    ['no scheme', 'linear.app/acme/issue/{key}'],
    ['credentials', 'https://user:secret@tickets.example.com/{key}'],
    ['a username', 'https://user@tickets.example.com/{key}'],
    ['the key as host', 'https://{key}'],
    ['the key in the host', 'https://{key}.example.com/x'],
    ['the key as port', 'https://tickets.example.com:{key}/x'],
    ['backslashes', 'https:\\\\example.com\\{key}'],
    ['an embedded newline', 'https://tickets.example.com/\n{key}'],
    ['an embedded tab', 'https://tickets.example.com/\t{key}'],
    ['a control character', 'https://tickets.example.com/\u0000{key}'],
    ['only whitespace', '   ']
  ])('rejects %s', (_name, template) => {
    expect(isTicketUrlTemplate(template)).toBe(false);
  });

  it('allows 500 characters after trimming and no more', () => {
    expect(ofLength(500)).toHaveLength(500);
    expect(isTicketUrlTemplate(ofLength(500))).toBe(true);
    expect(isTicketUrlTemplate(`  ${ofLength(500)}  `)).toBe(true);
    expect(isTicketUrlTemplate(ofLength(501))).toBe(false);
  });
});

describe('ticketUrlTemplate', () => {
  it('accepts a template or an empty value and names the rule of a bad one', () => {
    expect(ticketUrlTemplate('https://linear.app/acme/issue/{key}')).toEqual([]);
    expect(ticketUrlTemplate('  ')).toEqual([]);
    expect(ticketUrlTemplate('https://linear.app/acme/issue')).toEqual([
      expect.objectContaining({
        code: 'invalid_ticket_url_template',
        message:
          'Must be an http or https URL of at most 500 characters with {key} in its path or query.'
      })
    ]);
  });
});

describe('normalizeTicketUrlTemplate', () => {
  it('trims, clears empty and whitespace-only values, and keeps an omitted one omitted', () => {
    expect(normalizeTicketUrlTemplate('  https://linear.app/acme/issue/{key} ')).toBe(
      'https://linear.app/acme/issue/{key}'
    );
    expect(normalizeTicketUrlTemplate('')).toBeNull();
    expect(normalizeTicketUrlTemplate('   ')).toBeNull();
    expect(normalizeTicketUrlTemplate(null)).toBeNull();
    expect(normalizeTicketUrlTemplate(undefined)).toBeUndefined();
  });
});
