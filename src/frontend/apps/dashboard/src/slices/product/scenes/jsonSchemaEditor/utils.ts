export let generateUniqueId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export let validatePropertyName = (name: string) => {
  if (!name.trim()) {
    return 'Property name is required';
  }

  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return 'Property name must be a valid identifier';
  }

  return null;
};

export let formatJsonSchema = (schema: any) => {
  return JSON.stringify(schema, null, 2);
};
