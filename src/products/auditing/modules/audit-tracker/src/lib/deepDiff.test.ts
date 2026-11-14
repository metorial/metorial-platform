import { describe, expect, it } from 'vitest';
import { getPreviousAttributes } from './deepDiff';

describe('getPreviousAttributes', () => {
  it('returns only changed previous values from nested objects', () => {
    expect(
      getPreviousAttributes(
        {
          id: 'org_1',
          name: 'Previous',
          settings: {
            enabled: false,
            label: 'Unchanged'
          }
        },
        {
          id: 'org_1',
          name: 'Current',
          settings: {
            enabled: true,
            label: 'Unchanged'
          }
        }
      )
    ).toEqual({
      name: 'Previous',
      settings: {
        enabled: false
      }
    });
  });

  it('keeps removed old values and omits newly added values', () => {
    expect(
      getPreviousAttributes(
        {
          removed: 'old',
          unchanged: true
        },
        {
          added: 'new',
          unchanged: true
        }
      )
    ).toEqual({
      removed: 'old'
    });
  });

  it('preserves previous nulls when the current value changes', () => {
    expect(getPreviousAttributes({ value: null }, { value: 'set' })).toEqual({
      value: null
    });
  });

  it('returns the full previous array for meaningful array changes', () => {
    let previous = [
      { id: 'one', enabled: false },
      { id: 'two', enabled: true }
    ];

    expect(
      getPreviousAttributes(previous, [
        { id: 'one', enabled: true },
        { id: 'two', enabled: true }
      ])
    ).toBe(previous);
  });

  it('ignores Date changes at any object depth', () => {
    expect(
      getPreviousAttributes(
        {
          updatedAt: new Date('2026-08-12T10:00:00.000Z'),
          nested: {
            createdAt: new Date('2026-08-12T10:00:00.000Z')
          }
        },
        {
          updatedAt: new Date('2026-08-13T10:00:00.000Z'),
          nested: {
            createdAt: new Date('2026-08-13T10:00:00.000Z')
          }
        }
      )
    ).toBeUndefined();
  });

  it('omits changed Dates when another sibling changed', () => {
    expect(
      getPreviousAttributes(
        {
          name: 'Previous',
          updatedAt: new Date('2026-08-12T10:00:00.000Z')
        },
        {
          name: 'Current',
          updatedAt: new Date('2026-08-13T10:00:00.000Z')
        }
      )
    ).toEqual({
      name: 'Previous'
    });
  });

  it('ignores Date-only changes inside arrays', () => {
    expect(
      getPreviousAttributes(
        [{ id: 'one', updatedAt: new Date('2026-08-12T10:00:00.000Z') }],
        [{ id: 'one', updatedAt: new Date('2026-08-13T10:00:00.000Z') }]
      )
    ).toBeUndefined();
  });

  it('collapses unchanged payloads to undefined', () => {
    expect(
      getPreviousAttributes(
        { id: 'org_1', nested: { enabled: true } },
        { id: 'org_1', nested: { enabled: true } }
      )
    ).toBeUndefined();
  });
});
