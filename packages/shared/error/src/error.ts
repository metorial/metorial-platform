export interface ErrorData<Code extends string, Status extends number> {
  status: Status;
  code: Code;
  message: string;
  hint?: string;
  description?: string;
  reason?: string;
  [key: string]: any;
}

export type ErrorRecord<Code extends string, Status extends number> = {
  __typename: 'error';
  data: ErrorData<Code, Status>;
  toResponse: () => ErrorData<Code, Status> & { __typename: 'error'; ok: false };
} & ((extension?: Partial<ErrorData<Code, Status>>) => ErrorRecord<Code, Status>);

export let createError = <Code extends string, Status extends number>(
  data: ErrorData<Code, Status>
): ErrorRecord<Code, Status> => {
  return Object.assign(
    (extension: Partial<ErrorData<Code, Status>> = {}): ErrorRecord<Code, Status> =>
      createError({
        ...data,
        ...extension
      }),
    {
      __typename: 'error' as const,
      data,
      toResponse: () => ({ __typename: 'error' as const, ok: false as const, ...data })
    }
  );
};

export class ServiceError<InnerError extends ErrorRecord<any, any>> extends Error {
  __typename = 'ServiceError' as const;

  private _parent: Error | null = null;

  public get parent() {
    return this._parent;
  }

  constructor(private readonly error: InnerError) {
    super(error.data.message);
  }

  setParent(parent: Error) {
    this._parent = parent;
    return this;
  }

  get data() {
    return this.error.data;
  }

  toResponse() {
    return this.error.toResponse();
  }

  static fromResponse(raw: ErrorData<any, any>) {
    let data = raw;
    delete data.ok;
    delete data.__typename;

    return new ServiceError(createError(data));
  }
}

export let isError = (e: any): e is ServiceError<any> => {
  return e?.__typename === 'ServiceError' || e?.__typename === 'ErrorRecord';
};

export let isServiceError = isError;
