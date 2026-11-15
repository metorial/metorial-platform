export let proxy = <T extends object>(
  cb: (path: string[], ...args: any[]) => Promise<any>
): T => {
  let proxy: any = (path: string[]) =>
    new Proxy((() => {}) as any, {
      get: (target, prop: string) => {
        if (prop == 'toString') return () => `Client(${path.join('.')})`;
        return proxy([...path, prop]);
      },
      apply: (target, thisArg, args: any[]) => {
        if (path.length == 0) throw new Error('Cannot call root controller');

        return cb(path, ...args);
      }
    });

  return proxy([]);
};
