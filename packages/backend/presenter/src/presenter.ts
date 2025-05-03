import { introspectType, ValidationType } from '@metorial/validation';

export interface PresenterContext {
  // instance: Instance;
  apiVersion: 'v_2025_01_01_protostar';
  accessType:
    | 'api_key.publishable'
    | 'api_key.secret'
    | 'dashboard_token'
    | 'client_token'
    | 'event_system';
}

export interface PresenterResult {
  run: (i?: { expand?: string[] }) => Promise<any>;
}

export interface Expansion<Object extends {}, Context, UnpresentedOutput extends {}> {
  provider: (object: Object, context: Context) => Promise<UnpresentedOutput>;
  presenter: Presenter<PresentableType<any, UnpresentedOutput>, any>;
}

export class PresentableType<Name extends string, Type extends {}> {
  private constructor(public readonly name: Name) {}

  static create<Type extends {}>() {
    return <Name extends string>(name: Name) => new PresentableType<Name, Type>(name);
  }

  present(input: Type) {
    return { presenter: this.name, input };
  }
}

export type GetTypeOfPresentable<T> =
  T extends PresentableType<any, infer Type> ? Type : never;

export class Presenter<Type extends PresentableType<any, any>, Output extends {}> {
  private constructor(
    private readonly presentableType: Type,
    private readonly presenter: (
      input: GetTypeOfPresentable<Type>,
      context: PresenterContext
    ) => Promise<Output>,
    public readonly schema: ValidationType<Output>
  ) {}

  static $$create$$_internal<Type extends PresentableType<any, any>, Output extends {}>(
    presentableType: Type,
    presenter: (
      input: GetTypeOfPresentable<Type>,
      context: PresenterContext
    ) => Promise<Output>,
    type: ValidationType<Output>
  ) {
    return new Presenter(presentableType, presenter, type);
  }

  static create<Type extends PresentableType<any, any>>(name: Type) {
    return new PresenterBuilder<Type, any>(name);
  }

  present(input: GetTypeOfPresentable<Type>, context: PresenterContext): PresenterResult {
    // return this.presenter(input, context);

    return {
      run: async opts => {
        let { expand } = opts ?? {};

        let result = await this.presenter(input, context);

        // if (expand?.length) {
        //   for (let expansionKey of expand) {
        //     let expander = this.expansions[expansionKey];
        //     let canExpand = await context.expansions?.[expansionKey]?.();
        //     if (!expander || canExpand === false || canExpand === null) {
        //       throw new ServiceError(
        //         badRequestError({
        //           message: `Expansion "${expansionKey}" is not supported for object "${this.presentableType.name}"`
        //         })
        //       );
        //     }

        //     let expansionUnpresented = await expander.provider(result, context);
        //     let expansionValue = await expander.presenter
        //       .present(expansionUnpresented, { ...context, expansions: undefined })
        //       .run({});

        //     result = {
        //       ...result,
        //       [expansionKey]: expansionValue
        //     };
        //   }
        // }

        // @ts-ignore
        result.__typename = this.name;

        return result;
      }
    };
  }

  introspect() {
    return {
      name: this.presentableType.name,
      object: introspectType(this.schema)
      // expansions: Object.entries(this.expansions).map(([key, expansion]) => ({
      //   name: key,
      //   object: introspectType(expansion.presenter.schema)
      // }))
    };
  }
}

export class PresenterBuilder<Type extends PresentableType<any, any>, Output extends {}> {
  #presenter?: (
    input: GetTypeOfPresentable<Type>,
    context: PresenterContext
  ) => Promise<Output>;
  #type?: ValidationType<Output>;

  constructor(private readonly presentableType: Type) {}

  presenter<Output extends {}>(
    presenter: (
      input: GetTypeOfPresentable<Type>,
      context: PresenterContext
    ) => Promise<Output>
  ) {
    // @ts-ignore
    this.#presenter = presenter;
    return this as any as PresenterBuilder<Type, Output>;
  }

  schema(type: ValidationType<Output>) {
    this.#type = type;
    return this;
  }

  // expansion<Key extends string, Exp extends Expansion<Output, any, any>>(
  //   key: Key,
  //   expansion: Exp
  // ) {
  //   // @ts-ignore
  //   this.#expansions = {
  //     ...this.#expansions,
  //     [key]: expansion
  //   };
  //   return this as any as PresenterBuilder<Type, Output, Expansions & Record<Key, Exp>>;
  // }

  build() {
    if (!this.#presenter || !this.#type) {
      throw new Error('Presenter must have a presenter and a type');
    }

    return Presenter.$$create$$_internal(this.presentableType, this.#presenter!, this.#type!);
  }
}

export let declarePresenter = <Type extends PresentableType<any, any>>(
  type: Type,
  presenters: {
    v_2025_01_01_protostar: Presenter<Type, any>;
  }
) => ({
  type,
  present:
    (input: GetTypeOfPresentable<Type>) =>
    (context: PresenterContext): PresenterResult =>
      presenters[context.apiVersion].present(input, context),
  introspect: ({ apiVersion }: { apiVersion: string }) =>
    (presenters as any)[apiVersion].introspect()
});
