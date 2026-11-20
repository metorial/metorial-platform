import { describe, expect, it } from 'vitest';
import { mergeSignerKey, parseKeySet } from './keySet';

let functionsKey = { kid: 'f1', publicKey: 'pub-f1' };
let buildKey = { kid: 'b1', publicKey: 'pub-b1' };

let keysOf = (data: Record<string, string>) => parseKeySet(data['keys.json']).keys;

describe('mergeSignerKey', () => {
  it('publishes into an empty ConfigMap', () => {
    let result = mergeSignerKey(undefined, 'functions', functionsKey);

    expect(result.changed).toBe(true);
    expect(keysOf(result.data)).toEqual({ f1: 'pub-f1' });
    expect(parseKeySet(result.data['signer-functions.json']).keys).toEqual({ f1: 'pub-f1' });
  });

  it('keeps the keys of other signers', () => {
    let first = mergeSignerKey(undefined, 'functions', functionsKey);
    let second = mergeSignerKey(first.data, 'build', buildKey);

    expect(keysOf(second.data)).toEqual({ f1: 'pub-f1', b1: 'pub-b1' });
  });

  it('is unchanged when the key is already published', () => {
    let first = mergeSignerKey(undefined, 'functions', functionsKey);
    let second = mergeSignerKey(first.data, 'functions', functionsKey);

    expect(second.changed).toBe(false);
  });

  it('replaces only the signer own previous key', () => {
    let first = mergeSignerKey(undefined, 'functions', functionsKey);
    let withBuild = mergeSignerKey(first.data, 'build', buildKey);
    let rotated = mergeSignerKey(withBuild.data, 'functions', {
      kid: 'f2',
      publicKey: 'pub-f2'
    });

    expect(keysOf(rotated.data)).toEqual({ f2: 'pub-f2', b1: 'pub-b1' });
  });

  it('keeps keys it did not publish, such as those of the old install Job', () => {
    let legacy = {
      'keys.json': JSON.stringify({ keys: { f1: 'pub-f1', b1: 'pub-b1', manual: 'pub-m' } })
    };
    let result = mergeSignerKey(legacy, 'functions', functionsKey);

    expect(keysOf(result.data)).toEqual({ f1: 'pub-f1', b1: 'pub-b1', manual: 'pub-m' });
  });

  it('recovers from a corrupt or reset keys.json', () => {
    let first = mergeSignerKey(undefined, 'functions', functionsKey);
    let reset = mergeSignerKey(
      { ...first.data, 'keys.json': 'not json' },
      'functions',
      functionsKey
    );

    expect(reset.changed).toBe(true);
    expect(keysOf(reset.data)).toEqual({ f1: 'pub-f1' });
  });

  it('preserves unrelated data entries', () => {
    let result = mergeSignerKey({ other: 'value' }, 'functions', functionsKey);

    expect(result.data.other).toBe('value');
  });
});
