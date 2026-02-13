import opentelemetry, { SpanStatusCode } from '@opentelemetry/api';

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

  private constructor(
    private readonly id: string,
    object: () => Methods
  ) {
    this.#methods = object();
  }

  static create<Methods extends object>(id: string, object: () => Methods) {
    return new Service(id, object);
  }

  build() {
    // return this.#methods;

    let tracer = opentelemetry.trace.getTracer(`mt.service.${this.id}`);

    let methods: Record<string, any> = {};

    // Include own function methods for object-style services, excluding Object.prototype keys.
    let methodsPrototype = Object.getPrototypeOf(this.#methods);
    let prototypeProperties =
      methodsPrototype && methodsPrototype !== Object.prototype
        ? Object.getOwnPropertyNames(methodsPrototype)
        : [];
    let ownFunctionProperties =
      methodsPrototype === Object.prototype || methodsPrototype === null
        ? Object.entries(
            Object.getOwnPropertyDescriptors(this.#methods as Record<string, any>)
          )
            .filter(([, descriptor]) => typeof descriptor.value === 'function')
            .map(([key]) => key)
        : [];
    let properties = [...new Set([...prototypeProperties, ...ownFunctionProperties])];

    for (let methodName of properties) {
      if (methodName === 'constructor') continue;

      let method = (this.#methods as any)[methodName];

      if (typeof method == 'function') {
        methods[methodName] = (...args: any[]) => {
          return tracer.startActiveSpan(`${this.id}.${methodName}`, async span => {
            try {
              return await method.apply(this.#methods, args);
            } catch (error) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : String(error)
              });

              throw error;
            } finally {
              span.end();
            }
          });
        };
      } else {
        methods[methodName] = method;
      }
    }

    return methods as Methods;
  }
}
