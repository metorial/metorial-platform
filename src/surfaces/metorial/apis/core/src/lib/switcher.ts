export let switcher =
  <Switch extends { [key: string]: any }>(s: Switch) =>
  <Key extends keyof Switch>(
    key: Key
  ): Switch[Key] extends (...args: any[]) => any ? ReturnType<Switch[Key]> : Switch[Key] => {
    let v = s[key];
    if (typeof v == 'function') return v();
    return v;
  };
