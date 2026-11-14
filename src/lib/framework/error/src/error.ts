export interface ErrorData<Code extends string, Status extends number> {
  status: Status;
  code: Code;
  message: string;
  hint?: string;
  description?: string;
  reason?: string;
  [key: string]: any;
}

export type ErrorRecordExtension<Code extends string, Status extends number> = <
  NewCode extends string = Code
>(
  extension?: Partial<ErrorData<NewCode, Status>>
) => ErrorRecord<NewCode, Status>;

export type ErrorRecord<Code extends string, Status extends number> = {
  object: 'error';
  data: ErrorData<Code, Status>;
  toResponse: () => ErrorData<Code, Status> & { object: 'error'; ok: false };
} & ErrorRecordExtension<Code, Status>;

export let createError = <Code extends string, Status extends number>(
  data: ErrorData<Code, Status>
): ErrorRecord<Code, Status> => {
  return Object.assign(
    <NewCode extends string = Code>(
      extension: Partial<ErrorData<NewCode, Status>> = {}
    ): ErrorRecord<NewCode, Status> =>
      createError({
        ...data,
        ...extension
      }) as any,
    {
      object: 'error' as const,
      data,
      toResponse: () => ({ object: 'error' as const, ok: false as const, ...data })
    }
  ) as any;
};

export class ServiceError<InnerError extends ErrorRecord<any, any>> extends Error {
  object = 'ServiceError' as const;

  private _parent: Error | null = null;

  public get parent() {
    return this._parent;
  }

  constructor(private readonly error: InnerError) {
    super(`[@lowerdeck/error]: ${error.data.message} (${JSON.stringify(error.data)})`);
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

  toJSON() {
    return this.toResponse();
  }

  static fromResponse(raw: ErrorData<any, any>) {
    let data = { ...raw };
    delete data.ok;
    delete data.object;

    return new ServiceError(createError(data));
  }
}

export let isServiceError = (e: any): e is ServiceError<any> => {
  return e?.object === 'ServiceError' || e?.object === 'ErrorRecord';
};
