import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseArchive } from '../parse';
import { catalog, offering } from './fixtures';

let archiveOf = (value: unknown) => gzipSync(Buffer.from(JSON.stringify(value)));

describe('parseArchive', () => {
  it('returns the catalog with unknown fields intact', async () => {
    let source = {
      ...catalog({ offerings: [{ ...offering('o'), upcomingField: { nested: true } }] }),
      futureSection: [1, 2]
    };

    let parsed = await parseArchive(archiveOf(source));

    expect(parsed).toEqual(source);
  });

  it('defaults agents to an empty list', async () => {
    let { agents: _agents, ...withoutAgents } = catalog();

    let parsed = await parseArchive(archiveOf(withoutAgents));

    expect(parsed.agents).toEqual([]);
  });

  it('rejects a catalog with a missing section', async () => {
    let { offerings: _offerings, ...withoutOfferings } = catalog();

    await expect(parseArchive(archiveOf(withoutOfferings))).rejects.toThrow(
      /unexpected shape/
    );
  });

  it('rejects entities without their required fields', async () => {
    let broken = catalog({ offerings: [{ id: 'o', vendorId: 'vendor' } as never] });

    await expect(parseArchive(archiveOf(broken))).rejects.toThrow(/unexpected shape/);
  });

  it('rejects an archive that is not gzipped JSON', async () => {
    await expect(parseArchive(Buffer.from('{}'))).rejects.toThrow();
    await expect(parseArchive(gzipSync(Buffer.from('not json')))).rejects.toThrow();
  });
});
