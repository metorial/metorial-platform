export let cachedTransformers = new Map<string, (input: any) => any>([
  [`{}`, () => ({})],
  [`null`, () => null],
  [
    `{
  "env": $.config.env,
  "cmd": $.config.cmd,
  "args": $.config.args
}`,
    (input: any) => ({
      env: input.config.env,
      cmd: input.config.cmd,
      args: input.config.args
    })
  ],
  [
    `{
  "headers": $.config.headers,
  "query": $.config.query
}`,
    (input: any) => ({
      headers: input.config.headers,
      query: input.config.query
    })
  ]
]);
