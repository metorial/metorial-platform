import { badRequestError, ServiceError } from '@lowerdeck/error';

export let invalidInputError = (message: string) =>
  new ServiceError(badRequestError({ message }));
