export let flattenObject = (obj: object | Array<any>) => {
  let flattened: { [key: string]: any } = {};

  let recurse = (current: object | Array<any>, prefix: string) => {
    if (Array.isArray(current)) {
      current.forEach((value, index) => {
        let fullKey = `${prefix}[${index}]`;
        if (typeof value === 'object' && value !== null) {
          recurse(value, fullKey);
        } else {
          flattened[fullKey] = value;
        }
      });
    } else {
      Object.keys(current).forEach(key => {
        let value = current[key as keyof typeof current];
        let fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          recurse(value, fullKey);
        } else {
          flattened[fullKey] = value;
        }
      });
    }
  };

  recurse(obj, '');

  return flattened;
};
