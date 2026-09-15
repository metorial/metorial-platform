import type { ValidationType } from '@lowerdeck/validation';
import type { PresenterContext, PresenterResult } from '@metorial/presenter';

export interface EventPresenter {
  present: (input: any) => (context: PresenterContext) => PresenterResult;
}

export interface EventDefinition<Name extends string, Payload extends ValidationType<any>> {
  name: Name;
  payload: Payload;
  presenter: EventPresenter;
}

export let event = <T extends EventDefinition<string, any>>(definition: T) => definition;

export let eventSet = <T extends Record<string, EventDefinition<string, any>>>(events: T) =>
  events;

type UnionToIntersection<U> = (U extends any ? (arg: U) => void : never) extends (
  arg: infer I
) => void
  ? I
  : never;

export let combineEventSets = <T extends Record<string, EventDefinition<string, any>>[]>(
  ...eventSets: T
) => Object.assign({}, ...eventSets) as UnionToIntersection<T[number]>;
