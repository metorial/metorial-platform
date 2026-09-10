import type { ValidationType } from '@lowerdeck/validation';
import type { PresenterContext, PresenterResult } from '@metorial/presenter';

// Structural type matching both a plain `Presenter` (from `Presenter.create(...).build()`) and a
// `DeclaredPresenter` (from `declarePresenter(...)`, used by most real presenters in `@metorial/presenters`)
// — both expose this same `present(input)(context)` calling convention.
export interface EventPresenter {
  present: (input: any) => (context: PresenterContext) => PresenterResult;
}

export interface EventDefinition<Name extends string, Payload extends ValidationType<any>> {
  name: Name;
  payload: Payload;
  // Required, unlike audit-schema's `resource()` presenter — this is the entire enforcement
  // mechanism for "every event must be passed through a presenter first": an event can't be
  // declared here without one.
  presenter: EventPresenter;
}

export let event = <T extends EventDefinition<string, any>>(definition: T) => definition;

export let eventSet = <T extends Record<string, EventDefinition<string, any>>>(events: T) => events;

export let combineEventSets = <T extends Record<string, EventDefinition<string, any>>>(
  ...eventSets: T[]
) => Object.assign({}, ...eventSets) as T;
