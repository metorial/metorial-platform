// Run as `node case.cjs <wrapper-file> <event-file>`: invokes the extracted wrapper's handler and
// prints the results as JSON. The harness also copies this file next to the wrapper as index.js,
// where it is the "original handler" that the wrapper loads after installing its proxy hooks.

let timeoutMs = 5000;

let describeError = error => {
  let cause = error && error.cause;
  return {
    error: (cause && cause.code) || (error && error.code) || (error && error.name) || 'Error',
    message: String((cause && cause.message) || (error && error.message) || error)
  };
};

let nodeRequest = (moduleName, url) =>
  new Promise(resolve => {
    let mod = require(moduleName);
    let request = mod.get(url, response => {
      let chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode,
          body: Buffer.concat(chunks).toString('utf8').trim()
        })
      );
      response.on('error', error => resolve(describeError(error)));
    });
    request.setTimeout(timeoutMs, () =>
      request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    );
    request.on('error', error => resolve(describeError(error)));
  });

let fetchRequest = async url => {
  try {
    let response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: response.status, body: (await response.text()).trim() };
  } catch (error) {
    return describeError(error);
  }
};

let grpcRequest = target =>
  new Promise(resolve => {
    let grpc = require('@grpc/grpc-js');
    let identity = buffer => buffer;
    let definition = {
      ping: {
        path: '/differential.Echo/Ping',
        requestStream: false,
        responseStream: false,
        requestSerialize: identity,
        requestDeserialize: identity,
        responseSerialize: identity,
        responseDeserialize: identity
      }
    };
    let Client = grpc.makeGenericClientConstructor(definition, 'Echo');
    let client = new Client(target, grpc.credentials.createInsecure());
    client.ping(
      Buffer.from('ping'),
      { deadline: Date.now() + timeoutMs },
      (error, response) => {
        client.close();
        if (error)
          resolve({
            error: `grpc_${grpc.status[error.code] || error.code}`,
            message: error.details
          });
        else resolve({ status: 200, body: response.toString('utf8') });
      }
    );
  });

let perform = request => {
  if (request.kind == 'http') return nodeRequest('http', request.url);
  if (request.kind == 'https') return nodeRequest('https', request.url);
  if (request.kind == 'fetch') return fetchRequest(request.url);
  if (request.kind == 'grpc') return grpcRequest(request.url);
  return Promise.resolve({ error: 'unknown_kind', message: request.kind });
};

exports.handler = async event => {
  let results = [];
  for (let request of event.requests) {
    results.push({ id: request.id, ...(await perform(request)) });
  }
  return results;
};

if (require.main === module) {
  let [wrapperFile, eventFile] = process.argv.slice(2);
  let event = JSON.parse(require('fs').readFileSync(eventFile, 'utf8'));
  let run = async () => {
    try {
      let results = await require(wrapperFile).handler(event, {
        awsRequestId: 'differential'
      });
      process.stdout.write(JSON.stringify({ results }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ crashed: describeError(error) }));
    }
    process.exit(0);
  };
  run();
}
