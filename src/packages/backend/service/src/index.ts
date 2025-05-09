export type GetServiceControllerMethodClient<Method extends (...args: any[]) => any> = (
  ...args: Parameters<Method>
) => Promise<Awaited<ReturnType<Method>>>;

export type GetServiceControllerClient<Obj extends object> = {
  [K in keyof Obj]: Obj[K] extends (...args: any[]) => any
    ? GetServiceControllerMethodClient<Obj[K]>
    : never;
};

export class Service<Methods extends object> {
  #methods: Methods;

  private constructor(object: () => Methods) {
    this.#methods = object();
  }

  static create<Methods extends object>(id: string, object: () => Methods) {
    return new Service(object);
  }

  build() {
    return this.#methods;
  }
}
