import { describe, expect, test } from 'vitest';
import { isOutgoingEmailComplete } from './outgoingEmail';

describe('outgoing email completion', () => {
  test('does not delete shared content before every destination completes', () => {
    expect(
      isOutgoingEmailComplete({
        numberOfDestinations: 3,
        numberOfDestinationsCompleted: 1
      })
    ).toBe(false);
    expect(
      isOutgoingEmailComplete({
        numberOfDestinations: 3,
        numberOfDestinationsCompleted: 3
      })
    ).toBe(true);
  });
});
