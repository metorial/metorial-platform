import { describe, expect, it } from 'vitest';
import { InvalidReportError, parseReport } from './parse';
import { fixtureFiles } from './test/fixtures';

describe('parseReport', () => {
  it.each(fixtureFiles('reports').map(file => [file.name, file.value]))(
    'round-trips %s in canonical form',
    (_, value) => {
      expect(JSON.parse(JSON.stringify(parseReport(value)))).toEqual(value);
    }
  );

  it.each(fixtureFiles('invalid').map(file => [file.name, file.value]))(
    'rejects %s',
    (_, value) => {
      expect(() => parseReport(value)).toThrow(InvalidReportError);
    }
  );

  it('accepts absent optional fields and ignores unknown ones', () => {
    let [minimal] = fixtureFiles('reports').filter(file => file.name == 'minimal.json');
    let { buildVersion, publicUrl, ...rest } = minimal!.value as Record<string, unknown>;

    let parsed = parseReport({ ...rest, future: true });
    expect(parsed.buildVersion).toBeNull();
    expect(parsed.publicUrl).toBeNull();
    expect('future' in parsed).toBe(false);
  });
});
