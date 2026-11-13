import { Type } from './builders';

export type ErrorDefinition = {
  status: number;
  code: string;
  message: string;
  description?: string;
  data?: Record<string, Type<any>>;
};

export class ErrorSpec {
  constructor(readonly def: ErrorDefinition) {}

  toRaw() {
    return this.def;
  }
}

export let error = (def: ErrorDefinition) => new ErrorSpec(def);

export type MethodDefinition<I extends Type<any>, O extends Type<any>> = {
  input: I;
  output: O;
  errors?: ErrorSpec[];
  description?: string;
  deprecated?: string;
};

export class Method<I extends Type<any> = Type<any>, O extends Type<any> = Type<any>> {
  constructor(readonly def: MethodDefinition<I, O>) {}

  description(description: string) {
    return new Method<I, O>({ ...this.def, description });
  }

  deprecated(reason = '') {
    return new Method<I, O>({ ...this.def, deprecated: reason });
  }

  toRaw() {
    return this.def;
  }
}

export let method = <I extends Type<any>, O extends Type<any>>(def: MethodDefinition<I, O>) =>
  new Method(def);

export type Methods = { [key: string]: Method | Methods };

export type ServiceDefinition<M extends Methods = Methods> = {
  name: string;
  description?: string;
  go: { package: string };
  ts: { client: string };
  methods: M;
};

export class ServiceSpec<M extends Methods = Methods> {
  constructor(readonly def: ServiceDefinition<M>) {}

  toRaw() {
    return this.def;
  }
}

export let service = <M extends Methods>(def: ServiceDefinition<M>) => new ServiceSpec(def);
