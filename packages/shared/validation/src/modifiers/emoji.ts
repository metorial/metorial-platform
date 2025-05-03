import { ValidationModifier } from '../lib/types';

let emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;

export let emoji =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!emojiRegex.test(value)) {
      return [
        {
          code: 'invalid_emoji',
          message: opts?.message ?? 'Invalid emoji'
        }
      ];
    }

    return [];
  };
