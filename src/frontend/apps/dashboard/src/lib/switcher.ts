type SwitchResult<Value> = Value extends () => infer Result ? Result : Value;

export let switcher =
  <Switch extends Record<string, unknown>>(s: Switch) =>
  <Key extends keyof Switch>(key: Key): SwitchResult<Switch[Key]> => {
    let value = s[key];
    if (typeof value === 'function') {
      return (value as () => SwitchResult<Switch[Key]>)();
    }
    return value as SwitchResult<Switch[Key]>;
  };
