import { describe, expect, it } from 'vitest';
import { assertAiChatAllowed, reducedSubprocessorsErrorMessage } from './reducedSubprocessors';

describe('Metorial Assistant project access', () => {
  it('allows assistant use when enabled without compliance restrictions', () => {
    expect(() =>
      assertAiChatAllowed({ assistantEnabled: true, reducedSubprocessors: false })
    ).not.toThrow();
  });

  it('rejects assistant use when the project disables it', () => {
    expect(() =>
      assertAiChatAllowed({ assistantEnabled: false, reducedSubprocessors: false })
    ).toThrow('Metorial Assistant is disabled for this project.');
  });

  it.each([true, false])(
    'always rejects use with Reduced Subprocessors (preference: %s)',
    assistantEnabled => {
      expect(() =>
        assertAiChatAllowed({ assistantEnabled, reducedSubprocessors: true })
      ).toThrow(reducedSubprocessorsErrorMessage);
    }
  );
});
