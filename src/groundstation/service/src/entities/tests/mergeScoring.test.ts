import { describe, expect, it } from 'vitest';
import {
  candidateKeys,
  normalizeDisplayName,
  scoreMergeCandidate,
  splitEmail,
  type ScoredUser
} from '../mergeScoring';

let user = (input: Partial<ScoredUser>): ScoredUser => ({
  id: 'gen_x',
  name: null,
  emails: [],
  clientIdentityIds: [],
  ...input
});

describe('helpers', () => {
  it('splits emails into normalized local tokens', () => {
    expect(splitEmail('John.Doe+cursor@Acme.com')).toEqual({
      domain: 'acme.com',
      local: 'johndoe',
      tokens: ['john', 'doe']
    });
    expect(splitEmail('broken')).toBeNull();
  });

  it('normalizes display names and ignores single words', () => {
    expect(normalizeDisplayName('  José  Müller-Smith ')).toBe('jose muller smith');
    expect(normalizeDisplayName('admin')).toBeNull();
    expect(normalizeDisplayName(null)).toBeNull();
  });

  it('builds candidate keys from emails, names and client identities', () => {
    let keys = candidateKeys(
      user({ name: 'John Doe', emails: ['john.doe@acme.com'], clientIdentityIds: ['42'] })
    );

    expect(keys).toEqual(
      expect.arrayContaining(['local:johndoe', 'local:john', 'name:john doe', 'client:42'])
    );
  });
});

describe('scoreMergeCandidate', () => {
  it('suggests the same local part on the same domain', () => {
    let result = scoreMergeCandidate({
      discovered: user({ emails: ['john.doe@acme.com'] }),
      managed: user({ emails: ['johndoe@acme.com'] })
    });

    expect(result).toEqual({ score: 0.5, reasons: ['email_local_part'] });
  });

  it('suggests a local part prefix such as john and john.doe', () => {
    let result = scoreMergeCandidate({
      discovered: user({ emails: ['john@acme.com'] }),
      managed: user({ emails: ['john.doe@acme.com'] })
    });

    expect(result?.reasons).toEqual(['email_local_part_prefix']);
  });

  it('matches across allowed domains only', () => {
    let pair = {
      discovered: user({ emails: ['john.doe@acme.io'] }),
      managed: user({ emails: ['john.doe@acme.com'] })
    };

    expect(scoreMergeCandidate(pair)).toBeNull();
    expect(scoreMergeCandidate({ ...pair, allowedEmailDomains: ['acme.com'] })).toBeNull();
    expect(
      scoreMergeCandidate({ ...pair, allowedEmailDomains: ['ACME.com', 'acme.io'] })?.reasons
    ).toEqual(['email_local_part']);
  });

  it('compares against every alias email of the managed user', () => {
    let result = scoreMergeCandidate({
      discovered: user({ emails: ['jd@acme.com'] }),
      managed: user({ emails: ['john.doe@acme.com', 'jd@acme.com.alias', 'j.d@acme.com'] })
    });

    expect(result?.reasons).toEqual(['email_local_part']);
  });

  it('combines independent reasons', () => {
    let result = scoreMergeCandidate({
      discovered: user({
        name: 'John Doe',
        emails: ['john@acme.com'],
        clientIdentityIds: ['7']
      }),
      managed: user({
        name: 'john  doe',
        emails: ['john.doe@acme.com'],
        clientIdentityIds: ['7']
      })
    })!;

    expect(result.reasons).toEqual([
      'display_name',
      'email_local_part_prefix',
      'email_matches_name',
      'shared_client_identity'
    ]);
    expect(result.score).toBe(0.882);
  });

  it('matches a display name against an email-derived name', () => {
    let result = scoreMergeCandidate({
      discovered: user({ emails: ['ada.lovelace@other.org'] }),
      managed: user({ name: 'Ada Lovelace', emails: ['ada@acme.com'] })
    });

    expect(result).toEqual({ score: 0.3, reasons: ['email_matches_name'] });
  });

  it('returns nothing without any signal', () => {
    expect(
      scoreMergeCandidate({
        discovered: user({ name: 'Ada Lovelace', emails: ['ada@acme.com'] }),
        managed: user({ name: 'Bob Builder', emails: ['bob@acme.com'] })
      })
    ).toBeNull();
  });
});
