let placeholderNameAdjectives = [
  'brave',
  'calm',
  'clever',
  'cosmic',
  'cozy',
  'crisp',
  'daring',
  'eager',
  'fuzzy',
  'gentle',
  'golden',
  'happy',
  'jolly',
  'kind',
  'lively',
  'lucky',
  'mighty',
  'nimble',
  'proud',
  'quick',
  'quiet',
  'silver',
  'sunny',
  'swift',
  'trusty',
  'vivid',
  'witty'
];

let placeholderNameNouns = [
  'badger',
  'bear',
  'dolphin',
  'eagle',
  'falcon',
  'fox',
  'gecko',
  'hawk',
  'heron',
  'ibex',
  'koala',
  'lemur',
  'lynx',
  'moose',
  'orca',
  'otter',
  'panda',
  'puffin',
  'rabbit',
  'raven',
  'salmon',
  'sparrow',
  'stag',
  'tiger',
  'turtle',
  'whale',
  'wolf'
];

export let generatePlaceholderInstanceName = () => {
  let adjective =
    placeholderNameAdjectives[Math.floor(Math.random() * placeholderNameAdjectives.length)];
  let noun = placeholderNameNouns[Math.floor(Math.random() * placeholderNameNouns.length)];
  let number = Math.floor(Math.random() * 9) + 1;

  return `${adjective}-${noun}-${number}`;
};
