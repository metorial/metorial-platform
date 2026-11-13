import * as t from './builders';

export { t };
export type { Infer, Type, TypeDef, TypeMeta } from './builders';
export { compile, SpecError } from './compile';
export { generateGo } from './generate/go';
export { generateTs } from './generate/ts';
export * from './ir';
export { error, method, service, ErrorSpec, Method, ServiceSpec } from './spec';
export type { ErrorDefinition, MethodDefinition, Methods, ServiceDefinition } from './spec';
export { createValidatorFactory } from './validator';
