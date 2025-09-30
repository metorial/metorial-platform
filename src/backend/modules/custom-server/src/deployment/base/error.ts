export class DeploymentError extends Error {
  constructor(
    private readonly data: {
      code: string;
      message: string;
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
    return this.data.message;
  }
}
