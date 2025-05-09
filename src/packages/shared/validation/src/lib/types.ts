export interface ValidationError {
  code: string;
  message: string;

  expected?: any;
  received?: any;

  path?: string[];

  min?: number;
  max?: number;
  positive?: boolean;
  negative?: boolean;
}

export type ValidationResult<T> =
  | {
      success: true;
      value: T;
    }
  | {
      success: false;
      errors: ValidationError[];
    };

export type ValidationType<T> = {
  validate: (value: any) => ValidationResult<T>;
  examples?: T[];
  items?: ValidationType<any> | ValidationType<any>[];
  properties?: { [key: string]: ValidationType<any> };
  type: string;
  name?: string;
  description?: string;
  optional?: boolean;
  nullable?: boolean;
  hidden?: boolean;
};

export type ValidationTypeValue<T> = T extends ValidationType<infer U> ? U : never;

export type ValidationModifier<T> = (value: T) => ValidationError[];

export type Preprocessor = (value: any) => any;

export type Transformer<T> = (value: T) => T;

export interface ValidatorOptions<T> {
  modifiers?: ValidationModifier<T>[];
  transformers?: Transformer<T>[];
  message?: string;
  name?: string;
  description?: string;
  examples?: T[];
  preprocessors?: Preprocessor[];
  oneOf?: T[];
  hidden?: boolean;
}
