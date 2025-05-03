let isValidNumber = (n: any) => {
  return typeof n === 'number' && !isNaN(n) && n !== Infinity && n !== -Infinity;
};

let getValue = (json: any) => {
  return json === undefined || typeof json === 'symbol' ? null : json;
};

/**
 * Canonicalize some json according to https://www.rfc-editor.org/rfc/rfc8785
 */
export let canonicalize = (json: any): string => {
  if (typeof json === 'number' && !isValidNumber(json)) {
    throw new Error('canonicalize: cannot canonicalize non-number JSON');
  }

  if (json === undefined) return 'null';

  if (json instanceof Date) return JSON.stringify(json.toISOString());
  if (json instanceof RegExp) return JSON.stringify(json.toString());
  if (typeof json == 'bigint') return JSON.stringify(json.toString());

  if (json === null || typeof json !== 'object') {
    return JSON.stringify(json);
  }

  if (json.toJSON instanceof Function) {
    return canonicalize(json.toJSON());
  }

  if (Array.isArray(json)) {
    let inner = json.map(item => canonicalize(getValue(item))).join(',');
    return `[${inner}]`;
  }

  let inner = Object.keys(json)
    .sort()
    .map(key => `${canonicalize(key)}:${canonicalize(getValue(json[key]))}`)
    .join(',');
  return `{${inner}}`;
};
