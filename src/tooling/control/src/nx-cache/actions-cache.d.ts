declare module '@actions/cache' {
  export function restoreCache(
    paths: string[],
    primaryKey: string,
    restoreKeys?: string[]
  ): Promise<string | undefined>;

  export function saveCache(paths: string[], key: string): Promise<number>;
}
