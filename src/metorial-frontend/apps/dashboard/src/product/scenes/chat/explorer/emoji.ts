import type { ChatMessageEmoji } from '@metorial/state';

// Providers report reactions as shortcodes ("tada"), not as characters, so the
// explorer keeps a small map of the ones that actually show up in chat.
let shortcodeToCharacter: Record<string, string> = {
  '+1': '👍',
  '-1': '👎',
  thumbsup: '👍',
  thumbsdown: '👎',
  heart: '❤️',
  heart_eyes: '😍',
  smile: '😄',
  smiley: '😃',
  grin: '😁',
  joy: '😂',
  laughing: '😆',
  sweat_smile: '😅',
  slightly_smiling_face: '🙂',
  wink: '😉',
  thinking_face: '🤔',
  cry: '😢',
  sob: '😭',
  scream: '😱',
  raised_hands: '🙌',
  clap: '👏',
  wave: '👋',
  pray: '🙏',
  muscle: '💪',
  ok_hand: '👌',
  point_up: '☝️',
  eyes: '👀',
  tada: '🎉',
  confetti_ball: '🎊',
  rocket: '🚀',
  fire: '🔥',
  sparkles: '✨',
  star: '⭐',
  zap: '⚡',
  boom: '💥',
  bulb: '💡',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  ballot_box_with_check: '☑️',
  x: '❌',
  warning: '⚠️',
  question: '❓',
  exclamation: '❗',
  no_entry: '⛔',
  hourglass: '⏳',
  alarm_clock: '⏰',
  calendar: '📅',
  memo: '📝',
  books: '📚',
  chart_with_upwards_trend: '📈',
  bar_chart: '📊',
  mag: '🔍',
  lock: '🔒',
  key: '🔑',
  gear: '⚙️',
  wrench: '🔧',
  hammer: '🔨',
  bug: '🐛',
  robot_face: '🤖',
  robot: '🤖',
  ghost: '👻',
  skull: '💀',
  coffee: '☕',
  beer: '🍺',
  pizza: '🍕',
  cake: '🍰',
  100: '💯',
  ship: '🚢',
  package: '📦',
  bell: '🔔',
  loudspeaker: '📢',
  email: '📧',
  link: '🔗',
  pushpin: '📌',
  dart: '🎯',
  trophy: '🏆',
  medal: '🏅',
  crown: '👑',
  gem: '💎',
  money_with_wings: '💸',
  moneybag: '💰',
  rainbow: '🌈',
  sunny: '☀️',
  cloud: '☁️',
  snowflake: '❄️',
  seedling: '🌱',
  four_leaf_clover: '🍀'
};

let hasNonAsciiSymbol = (value: string) => {
  for (let character of value) {
    if (character.codePointAt(0)! > 0x2000) return true;
  }

  return false;
};

export type ResolvedEmoji = {
  character: string | null;
  imageUrl: string | null;
  label: string;
};

export let resolveEmoji = (emoji: ChatMessageEmoji): ResolvedEmoji => {
  if (emoji.type == 'custom') {
    return {
      character: null,
      imageUrl: emoji.url ?? null,
      label: `:${emoji.name}:`
    };
  }

  let value = emoji.value.replace(/^:|:$/g, '');

  if (hasNonAsciiSymbol(value)) {
    return { character: value, imageUrl: null, label: value };
  }

  return {
    character: shortcodeToCharacter[value] ?? null,
    imageUrl: null,
    label: `:${value}:`
  };
};

export let getEmojiShortcode = (emoji: ChatMessageEmoji) =>
  emoji.type == 'custom' ? emoji.name : emoji.value.replace(/^:|:$/g, '');

export let quickReactions = [
  { shortcode: 'thumbsup', character: '👍' },
  { shortcode: 'heart', character: '❤️' },
  { shortcode: 'smile', character: '😄' },
  { shortcode: 'tada', character: '🎉' },
  { shortcode: 'eyes', character: '👀' },
  { shortcode: 'white_check_mark', character: '✅' },
  { shortcode: 'rocket', character: '🚀' },
  { shortcode: 'pray', character: '🙏' }
];
