import { describe, expect, it, vi } from 'vitest';
import { validateTriggerGroupSelections } from './triggerGroupSelection';

let legacy: any = { id: 'legacy', invocation: { type: 'polling', intervalSeconds: 900 } };
let selected: any = {
  id: 'selected',
  invocation: { type: 'webhook', registration: { mode: 'auto' } },
  selectionSchema: {
    type: 'object',
    properties: { resourceId: { type: 'string' } },
    required: ['resourceId'],
    additionalProperties: false
  }
};
let optional: any = {
  id: 'optional',
  invocation: { type: 'webhook', registration: { mode: 'auto' } },
  selectionSchema: {
    type: 'object',
    properties: { resourceId: { type: 'string' } },
    additionalProperties: false
  }
};

describe('trigger group selections', () => {
  it('keeps older groups optional and validates required resource selections', () => {
    let none = validateTriggerGroupSelections([legacy]);
    expect(none.selections.size).toBe(0);
    expect(none.skippedGroupIds.size).toBe(0);
    expect(none.ignoredSelectionKeys).toEqual([]);

    let chosen = validateTriggerGroupSelections([selected], {
      selected: { resourceId: 'resource' }
    });
    expect(chosen.selections.get('selected')).toEqual({ resourceId: 'resource' });
    expect(chosen.skippedGroupIds.size).toBe(0);
  });

  it('skips only the group whose required selection was omitted', () => {
    let result = validateTriggerGroupSelections([legacy, selected, optional]);

    expect([...result.skippedGroupIds]).toEqual(['selected']);
    expect(result.selections.has('selected')).toBe(false);
    expect(result.selections.get('optional')).toEqual({});

    let partial = validateTriggerGroupSelections([legacy, selected, optional], {
      optional: { resourceId: 'resource' }
    });

    expect([...partial.skippedGroupIds]).toEqual(['selected']);
    expect(partial.selections.get('optional')).toEqual({ resourceId: 'resource' });
  });

  it('activates a group with an empty selection when its schema accepts one', () => {
    let result = validateTriggerGroupSelections([optional]);

    expect(result.skippedGroupIds.size).toBe(0);
    expect(result.selections.get('optional')).toEqual({});
  });

  it('rejects a schema that cannot be compiled whether or not a selection was given', () => {
    let logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    let broken: any = { ...selected, id: 'broken', selectionSchema: { type: 'not-a-type' } };

    expect(() => validateTriggerGroupSelections([legacy, broken])).toThrow(
      'Could not validate trigger_group_selection.'
    );
    expect(() => validateTriggerGroupSelections([legacy, broken], {})).toThrow(
      'Could not validate trigger_group_selection.'
    );
    expect(() =>
      validateTriggerGroupSelections([legacy, broken], { broken: { resourceId: 'resource' } })
    ).toThrow('Could not validate trigger_group_selection.');

    logged.mockRestore();
  });

  it('skips every group when each one needs a selection and none was given', () => {
    let result = validateTriggerGroupSelections([selected, { ...selected, id: 'second' }], {});

    expect([...result.skippedGroupIds]).toEqual(['selected', 'second']);
    expect(result.selections.size).toBe(0);
  });

  it('rejects a provided selection that does not match the schema', () => {
    expect(() =>
      validateTriggerGroupSelections([legacy, selected], { selected: {} })
    ).toThrow();
    expect(() =>
      validateTriggerGroupSelections([legacy, selected], { selected: { resourceId: 1 } })
    ).toThrow();
    expect(() =>
      validateTriggerGroupSelections([legacy, selected], {
        selected: { resourceId: 'resource', extra: true }
      })
    ).toThrow();
  });

  it('ignores and reports selections for unknown groups or groups without a selection', () => {
    let result = validateTriggerGroupSelections([legacy, selected], {
      unknown: { resourceId: 'gone' },
      legacy: {},
      selected: { resourceId: 'resource' }
    });

    expect(result.ignoredSelectionKeys).toEqual(['unknown', 'legacy']);
    expect([...result.selections.keys()]).toEqual(['selected']);
    expect(result.skippedGroupIds.size).toBe(0);

    expect(validateTriggerGroupSelections([selected], {}).ignoredSelectionKeys).toEqual([]);
  });

  it('still rejects malformed selections for ignored groups', () => {
    expect(() =>
      validateTriggerGroupSelections([legacy], { unknown: 'value' as any })
    ).toThrow();
    expect(() =>
      validateTriggerGroupSelections([legacy], { ['x'.repeat(200)]: {} })
    ).toThrow();
  });

  it('rejects oversized, deeply nested, and overly numerous input', () => {
    expect(() =>
      validateTriggerGroupSelections([selected], {
        selected: { resourceId: 'a'.repeat(65536) }
      })
    ).toThrow('size limit');
    let nested: any = {};
    for (let i = 0; i < 20; i++) nested = { child: nested };
    expect(() => validateTriggerGroupSelections([selected], { selected: nested })).toThrow(
      'nesting depth'
    );
    let listed: any = [];
    for (let i = 0; i < 20; i++) listed = [listed];
    expect(() =>
      validateTriggerGroupSelections([selected], { selected: { resourceId: listed } })
    ).toThrow('nesting depth');
    expect(() =>
      validateTriggerGroupSelections(
        [selected],
        Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`group-${i}`, {}]))
      )
    ).toThrow('size limit');
  });

  it('does not mistake an inherited property for the selection of a group', () => {
    let result = validateTriggerGroupSelections([{ ...selected, id: 'toString' }], {});

    expect([...result.skippedGroupIds]).toEqual(['toString']);
    expect(result.selections.size).toBe(0);
  });
});
