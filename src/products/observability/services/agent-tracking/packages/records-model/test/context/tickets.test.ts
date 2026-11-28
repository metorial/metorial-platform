import { describe, expect, it } from 'vitest';
import { normalizeTicketRefs, ticketRefsFromBranch } from '../../src/context/tickets';

describe('ticketRefsFromBranch', () => {
  it.each([
    ['feature/ENG-123-add-login', ['ENG-123']],
    ['ENG-1', ['ENG-1']],
    ['fix/PROJ2-45_and_OPS-7', ['PROJ2-45', 'OPS-7']],
    ['ENG-123/ENG-123-again', ['ENG-123']],
    ['ivan/mt-365-title', ['MT-365']],
    ['feature/eng-12-login', ['ENG-12']],
    ['feature/Eng-12-login', ['ENG-12']],
    ['mt-365', ['MT-365']],
    ['PROJ_2-14', ['PROJ_2-14']],
    ['fix-for-ENG-9', ['ENG-9']],
    ['ivan/fix-eng-12', []],
    ['fix/abc-0', []],
    ['fix/abc-012', []],
    ['utf-8', []],
    ['sha-256', []],
    ['x86-64', []],
    ['v2-1', []],
    ['h2-3', []],
    ['release-2024', []],
    ['release-2026-01', []],
    ['feature/UTF-8-and-SHA-256', []],
    ['E-1', []],
    ['XENG-12a', []],
    ['ABCDEFGHIJK-1', []],
    ['ENG-12345678', []],
    ['user/JIRA-123_ABC-456', ['JIRA-123', 'ABC-456']],
    ['copilot/fix-123', []],
    ['codex/task-1', []],
    ['bugfix/issue-42', []],
    ['dependabot/npm_and_yarn/lodash-4.17.21', []],
    ['dependabot/npm_and_yarn/ENG-12', []],
    ['renovate/eslint-9.x', []],
    ['renovate/ENG-12', []],
    ['lodash-4.17.21', []],
    ['LODASH-4.17', []],
    ['eslint-9.x', []],
    ['bump/go-1.22', []],
    ['feature/oauth-2', []],
    ['wip/part-2', []],
    ['pr-12', []],
    ['gh-123', []],
    ['fix_eng-12', []],
    ['ivan/fix_eng-12', []],
    ['team/x86_64-1', []],
    ['feat/chore-3', []],
    ['fix/covid-19-banner', []],
    ['feature/aes-256-gcm', []],
    ['rsa-2048-keys', []],
    ['docs/pep-8', []],
    ['ECMA-262', []],
    ['wcag-2-contrast', []],
    ['ieee-754-rounding', []],
    ['html-5-forms', []],
    ['css-3-grid', []],
    ['mp-4-upload', []],
    ['ipv-6-support', []],
    ['owasp-10-review', []],
    ['pci-4-audit', []],
    ['soc-2-controls', []],
    ['fix/win-11-paths', []],
    ['mac-15-build', []],
    ['feature/MAC-15-and-ENG-4', ['MAC-15', 'ENG-4']],
    ['feature/IOS-123-login', ['IOS-123']],
    ['ios-17-support', []],
    ['api-2-migration', []],
    ['fix-12-foo', []],
    ['feature/API-42_UI-7', ['API-42', 'UI-7']],
    ['AUTH-12/DOCS-3/TEST-4/BUG-5', ['AUTH-12', 'DOCS-3', 'TEST-4', 'BUG-5']],
    ['WIN-11-paths', ['WIN-11']],
    [
      'SOC-2/PCI-4/MP-4/CSS-3/GO-1/NODE-9',
      ['SOC-2', 'PCI-4', 'MP-4', 'CSS-3', 'GO-1', 'NODE-9']
    ],
    ['feature/CVE-2024-fix', []],
    ['fix/HTML-5-forms', []],
    ['RSA-2048', []],
    ['OWASP-10/IEEE-754/X86-64', []],
    ['main', []]
  ])('extracts from %s', (branch, refs) => {
    expect(ticketRefsFromBranch(branch)).toEqual(refs);
  });

  it('keeps the order the refs appear in', () => {
    expect(ticketRefsFromBranch('ops-4/fix-ENG-2-and-BILL-3')).toEqual([
      'OPS-4',
      'ENG-2',
      'BILL-3'
    ]);
  });

  it('handles a missing branch', () => {
    expect(ticketRefsFromBranch(undefined)).toEqual([]);
  });

  it('caps the number of refs', () => {
    let branch = Array.from({ length: 20 }, (_, index) => `AB-${index + 1}`).join('/');

    expect(ticketRefsFromBranch(branch)).toHaveLength(8);
  });
});

describe('normalizeTicketRefs', () => {
  it('uppercases keys and keeps issue numbers', () => {
    expect(normalizeTicketRefs(['mt-365', ' ENG-12 ', '#42', 'PROJ_2-14', 'Jira-7'])).toEqual([
      'MT-365',
      'ENG-12',
      '#42',
      'PROJ_2-14',
      'JIRA-7'
    ]);
  });

  it.each([
    'utf-8',
    'SHA-256',
    'v2-1',
    'ENG-0',
    'ENG-012',
    '#0',
    '#',
    '#12a',
    'ENG 12',
    'ENG-12 and more',
    'fix ENG-12',
    'E-1',
    'Proj_2-14',
    'lodash-4.17',
    'COVID-19',
    'AES-256',
    'RSA-2048',
    'PEP-8',
    'ECMA-262',
    'WCAG-2',
    'IEEE-754',
    'HTML-5',
    'IPV-6',
    'OWASP-10',
    ''
  ])('rejects %j', ref => {
    expect(normalizeTicketRefs([ref])).toEqual([]);
  });

  it('keeps explicit refs whose prefix is denied only in lowercase branch segments', () => {
    expect(
      normalizeTicketRefs([
        'TASK-1',
        'gh-123',
        'fix-123',
        'IOS-123',
        'mac-15',
        'SOC-2',
        'WIN-11'
      ])
    ).toEqual(['TASK-1', 'GH-123', 'FIX-123', 'IOS-123', 'MAC-15', 'SOC-2', 'WIN-11']);
  });

  it('dedupes and caps', () => {
    expect(normalizeTicketRefs(['eng-1', 'ENG-1', '#1', '#1'])).toEqual(['ENG-1', '#1']);
    expect(
      normalizeTicketRefs(Array.from({ length: 20 }, (_, index) => `AB-${index + 1}`))
    ).toHaveLength(8);
  });
});
