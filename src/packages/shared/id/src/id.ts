import { Hash } from '@metorial/hash';
import { customAlphabet } from 'nanoid';
import short from 'short-uuid';

let translator = short('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');

let _defaultId = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  20
);

let _code = customAlphabet('0123456789', 6);

export let idTime = () => new Date().getTime().toString(36).padStart(9, '0');

let seenPrefixes = new Set<string>();
let checkPrefix = (prefix: string) => {
  if (prefix.endsWith('_')) prefix = prefix.slice(0, -1);

  if (seenPrefixes.has(prefix)) {
    throw new Error(`Prefix ${prefix} already exists`);
  }
};

export let idType = {
  sorted: (prefix: string, length: number = 22) => {
    checkPrefix(prefix);

    return {
      prefix,
      length,
      type: 'sorted' as const
    };
  },
  unsorted: (prefix: string, length: number = 22) => {
    checkPrefix(prefix);

    return {
      prefix,
      length,
      type: 'unsorted' as const
    };
  },
  key: (prefix: string, length: number = 50) => {
    checkPrefix(prefix);

    return { prefix, length, type: 'key' as const };
  }
};

export let createIdGenerator = <
  T extends {
    [key: string]: {
      prefix: string;
      length: number;
      type: 'sorted' | 'key' | 'unsorted';
    };
  }
>(
  idPrefixes: T
) => {
  for (let key in idPrefixes) {
    if (!idPrefixes[key].prefix.endsWith('_')) {
      idPrefixes[key].prefix = `${idPrefixes[key].prefix}_`;
    }
  }

  let getIdDescription = (prefix: keyof T) => {
    let pf = idPrefixes[prefix];
    if (!pf) throw new Error(`Invalid prefix: ${prefix as string}`);

    return pf;
  };

  return {
    generateId: async (prefix: keyof T) => {
      let desc = getIdDescription(prefix);
      let length = desc.length;

      if (desc.type == 'sorted') {
        let date = idTime();

        let remainingLength = length - date.length;
        if (remainingLength < 10) remainingLength = 10;

        return `${desc.prefix}${date}${_defaultId(remainingLength)}`;
      } else if (desc.type == 'unsorted') {
        return `${desc.prefix}${_defaultId(length)}`;
      } else {
        let main = `${desc.prefix}${_defaultId(length)}`;
        return `${main}${(await Hash.sha512(main)).slice(0, 6)}`;
      }
    },
    generateIdSync: (prefix: keyof T) => {
      let desc = getIdDescription(prefix);
      let length = desc.length;

      if (desc.type == 'sorted') {
        let date = idTime();

        let remainingLength = length - date.length;
        if (remainingLength < 10) remainingLength = 10;

        return `${desc.prefix}${date}${_defaultId(remainingLength)}`;
      } else if (desc.type == 'unsorted') {
        return `${desc.prefix}${_defaultId(length)}`;
      } else {
        throw new Error('Cannot generate key id synchronously');
      }
    },
    idPrefixes: Object.entries(idPrefixes).reduce(
      (acc, [key, value]) => {
        // @ts-ignore
        acc[key] = value.prefix;
        return acc;
      },
      {} as { [key in keyof T]: string }
    ),

    normalizeUUID: (prefix: keyof T, uuid: string) => {
      let desc = getIdDescription(prefix);

      return `${desc.prefix}${translator.fromUUID(uuid)}`;
    }
  };
};

export let generateCustomId = (prefix?: string, length: number = 20) => {
  if (prefix && !prefix.endsWith('_')) prefix = `${prefix}_`;

  return `${prefix}${_defaultId(length)}`;
};

export let generatePlainId = (length: number = 20) => {
  return _defaultId(length);
};

export let generateId = (prefix: string, length: number = 20) => {
  let date = idTime();

  let remainingLength = length - date.length;
  if (remainingLength < 10) remainingLength = 10;

  return `${prefix}${date}${_defaultId(remainingLength)}`;
};

export let generateCode = (length: number = 6) => {
  return _code(length);
};
