export let errorTs = `export class DeploymentError extends Error {
  constructor(
    private readonly data: {
      code: string;
      message: string;
      publicMessage?: string;
      details?: any;
    }
  ) {
    super(data.message);
    this.name = 'DeploymentError';
  }

  get code() {
    return this.data.code;
  }

  get publicMessage() {
    return this.data.publicMessage;
  }

  get details() {
    return this.data.details;
  }
}
`;
