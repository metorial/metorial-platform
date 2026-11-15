export let deepenObject = (obj: Record<string, any>) => {
  let deepened: any = Object.keys(obj)[0].startsWith('[') ? [] : {};

  Object.keys(obj).forEach(key => {
    let value = obj[key as keyof typeof obj];
    let parts = key.split('.').flatMap(p =>
      p.split('[').map(p => {
        let isArray = p.endsWith(']');

        if (isArray) {
          return {
            type: 'array' as const,
            index: parseInt(p.slice(0, -1))
          };
        } else {
          return {
            type: 'object' as const,
            name: p
          };
        }
      })
    );

    let current = deepened;

    for (let partIndex in parts.slice(0, -1)) {
      let part = parts[partIndex];
      let nextPart = parts[parseInt(partIndex) + 1];

      if (part.type === 'array') {
        if (!current[part.index]) {
          current[part.index] = nextPart.type === 'array' ? [] : {};
        }
        current = current[part.index];
      } else {
        if (!current[part.name]) {
          current[part.name] = nextPart.type === 'array' ? [] : {};
        }
        current = current[part.name];
      }
    }

    let lastPart = parts[parts.length - 1];

    if (lastPart.type === 'array') {
      if (!current[lastPart.index]) current[lastPart.index] = value;
    } else {
      if (!current[lastPart.name]) current[lastPart.name] = value;
    }
  });

  return deepened;
};
