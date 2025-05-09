export let merge = (target: any, ...sources: any[]): any => {
  if (!sources.length) return target;

  let source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (let key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        merge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return merge(target, ...sources);
};

export let isObject = (item: any) => {
  return item && typeof item === 'object' && !Array.isArray(item);
};
