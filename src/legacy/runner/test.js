console.log(
  JSON.stringify(
    {
      test: 'test',
      test2: 'test2'
      // env: process.env
    },
    null,
    2
  )
);

while (true) {}

// timeout 5s deno run --v8-flags=--max-old-space-size=20 --allow-read=./test.js --deny-write --deny-env --deny-sys --deny-net --deny-run --deny-ffi ./test.js
