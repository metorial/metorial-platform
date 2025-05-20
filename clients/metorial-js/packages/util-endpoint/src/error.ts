// export class MetorialError extends Error {
//   __typename: 'metorial.error' | 'metorial.sdk.error' = 'metorial.error';
//   __isMetorialError = true;

//   constructor(message: string) {
//     super(`[METORIAL ERROR]: ${message}`);
//   }

//   static isMetorialError(error: any): error is MetorialError {
//     return error?.__isMetorialError;
//   }
// }

const METORIAL_SDK_ERROR = 'metorial.sdk.error' as const;

export class MetorialSDKError extends Error {
  __typename = METORIAL_SDK_ERROR;
  __isMetorialError = true;

  constructor(
    public readonly response: {
      status: number;
      code: string;
      message: string;
      hint?: string;
      description?: string;
      entity?: string;
      reason?: string;
      errors?: {
        code: string;
        message: string;
        expected?: any;
        received?: any;
        path?: string[];
        min?: number;
        max?: number;
        positive?: boolean;
        negative?: boolean;
      }[];
      [key: string]: any;
    }
  ) {
    // console.log(`[METORIAL ERROR]: ${response.code} - ${response.message}`);
    // console.error('Response:');
    // console.error(JSON.stringify(response, null, 2));

    super(`[METORIAL ERROR]: ${response.code} - ${response.message}`);
  }

  get code() {
    return this.response.code;
  }

  get message() {
    return this.response.message;
  }

  get hint() {
    return this.response.hint;
  }

  get description() {
    return this.response.description;
  }

  get reason() {
    return this.response.reason;
  }

  get validationErrors() {
    return this.response.errors;
  }

  get entity() {
    return this.response.entity;
  }
}

export let isMetorialSDKError = (error: any): error is MetorialSDKError => {
  return (
    error?.__typename === METORIAL_SDK_ERROR ||
    error.__isMetorialError ||
    error instanceof MetorialSDKError
  );
};
