import { LambdaServerInstance } from '@metorial/db';
import { AwsLambdaCallbackHandler } from './aws-lambda/impl/callbacks';
import { AwsLambdaOAuthHandler } from './aws-lambda/impl/oauth';
import { DenoCallbackHandler } from './deno/impl/callbacks';
import { DenoOAuthHandler } from './deno/impl/oauth';

export let getCallbackHandler = (lambda: LambdaServerInstance) => {
  switch (lambda.provider) {
    case 'deno_deploy':
    case 'deno_self_hosted':
      return new DenoCallbackHandler(lambda);

    case 'aws_lambda':
      return new AwsLambdaCallbackHandler(lambda);

    default:
      throw new Error(`Unsupported lambda provider: ${lambda.provider}`);
  }
};

export let getOAuthHandler = (lambda: LambdaServerInstance) => {
  switch (lambda.provider) {
    case 'deno_deploy':
    case 'deno_self_hosted':
      return new DenoOAuthHandler(lambda);

    case 'aws_lambda':
      return new AwsLambdaOAuthHandler(lambda);

    default:
      throw new Error(`Unsupported lambda provider: ${lambda.provider}`);
  }
};
