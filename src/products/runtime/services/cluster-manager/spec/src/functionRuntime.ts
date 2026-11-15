import { method, service } from '@lowerdeck/rpc-spec';
import { invocationUnauthorized, InvokeInput, InvokeOutput } from './invoke';

export default service({
  name: 'function-runtime',
  description: 'The supervisor inside every function pod. Called by the cluster-manager through Knative.',
  go: { package: 'functionruntimerpc' },
  ts: { client: 'FunctionRuntimeClient' },

  methods: {
    invoke: method({
      input: InvokeInput,
      output: InvokeOutput,
      errors: [invocationUnauthorized]
    })
      .idempotent(false)
      .description('Runs the handler once. Function failures are successful results carrying the envelope.')
  }
});
