import { describe, expect, it } from 'vitest';
import { classificationUpdate, hostedModelPromptText } from './classification';

describe('classificationUpdate', () => {
  it('keeps the hosted model choice while automatic assignment is on', () => {
    expect(classificationUpdate({ deterministicEnabled: true, aiEnabled: true })).toEqual({
      deterministicEnabled: true,
      aiEnabled: true
    });
    expect(classificationUpdate({ deterministicEnabled: true, aiEnabled: false })).toEqual({
      deterministicEnabled: true,
      aiEnabled: false
    });
  });

  it('never sends the hosted model as on while automatic assignment is off', () => {
    expect(classificationUpdate({ deterministicEnabled: false, aiEnabled: true })).toEqual({
      deterministicEnabled: false,
      aiEnabled: false
    });
    expect(classificationUpdate({ deterministicEnabled: false, aiEnabled: false })).toEqual({
      deterministicEnabled: false,
      aiEnabled: false
    });
  });
});

describe('hostedModelPromptText', () => {
  it('says the first prompt is sent only when the environment keeps prompt text', () => {
    expect(hostedModelPromptText('full')).toBe(
      "This environment keeps prompt text, so the first 2,000 characters of the session's first prompt are sent too."
    );
    expect(hostedModelPromptText('shape')).toBe(
      'This environment does not keep prompt text, so no prompt is sent.'
    );
    expect(hostedModelPromptText('basic')).toBe(
      'This environment does not keep prompt text, so no prompt is sent.'
    );
  });
});
