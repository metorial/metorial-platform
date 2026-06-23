let f = Bun.file('./server.ts');
console.log(
  JSON.stringify(
    [
      {
        filename: 'index.ts',
        content: await f.text(),
        encoding: 'utf-8'
      },
      {
        filename: 'package.json',
        content: JSON.stringify({
          name: 'my-mcp-server',
          type: 'module',
          dependencies: {
            '@metorial/mcp-server': 'latest',
            '@metorial/mcp': 'latest'
          }
        })
      }
    ],
    null,
    2
  )
);
