import { describe, expect, it } from 'vitest';
import { getDocumentDraftActors, withDocumentDraftActor } from './documentDraftActors';

describe('getDocumentDraftActors', () => {
  it('returns the actors a draft carries', () => {
    expect(
      getDocumentDraftActors({
        actors: [{ id: 'rac_1', context: { ip: '10.0.0.1', ua: 'Firefox' } }]
      })
    ).toEqual([{ id: 'rac_1', context: { ip: '10.0.0.1', ua: 'Firefox' } }]);
  });

  it('still reads drafts written before contexts were captured', () => {
    expect(
      getDocumentDraftActors({ actors: [], actorIds: ['rac_1', 'rac_2'] })
    ).toEqual([{ id: 'rac_1' }, { id: 'rac_2' }]);
  });

  it('prefers the entry carrying a context when a draft has both forms', () => {
    expect(
      getDocumentDraftActors({
        actorIds: ['rac_1'],
        actors: [{ id: 'rac_1', context: { ip: '10.0.0.1' } }]
      })
    ).toEqual([{ id: 'rac_1', context: { ip: '10.0.0.1' } }]);
  });

  it('does not hand out references into the draft it was given', () => {
    let draft = { actors: [{ id: 'rac_1', context: { ip: '10.0.0.1' } }] };
    let actors = getDocumentDraftActors(draft);

    actors[0]!.context = { ip: '10.0.0.9' };

    expect(draft.actors[0]!.context).toEqual({ ip: '10.0.0.1' });
  });
});

describe('withDocumentDraftActor', () => {
  it('adds a participant that has not edited the draft yet', () => {
    expect(
      withDocumentDraftActor({ actors: [{ id: 'rac_1' }] }, {
        id: 'rac_2',
        context: { ip: '10.0.0.2' }
      })
    ).toEqual([{ id: 'rac_1' }, { id: 'rac_2', context: { ip: '10.0.0.2' } }]);
  });

  it('does not duplicate a participant that has already edited', () => {
    expect(
      withDocumentDraftActor({ actors: [{ id: 'rac_1', context: { ip: '10.0.0.1' } }] }, {
        id: 'rac_1',
        context: { ip: '10.0.0.9' }
      })
    ).toEqual([{ id: 'rac_1', context: { ip: '10.0.0.1' } }]);
  });

  it('fills in a context for a participant carried over without one', () => {
    expect(
      withDocumentDraftActor({ actors: [], actorIds: ['rac_1'] }, {
        id: 'rac_1',
        context: { ip: '10.0.0.1' }
      })
    ).toEqual([{ id: 'rac_1', context: { ip: '10.0.0.1' } }]);
  });
});
