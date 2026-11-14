import { v, type ValidationModifier, type ValidationType } from '@lowerdeck/validation';
import { maxSafeInteger, type IR, type IRField, type IRNamedType, type IRType } from './ir';

// Defines what a spec-validated input means: the Go runtime (ldrpc's schema interpreter) is
// tested against these validators issue by issue, and a spec-first TypeScript server would
// validate its inputs with them.
// v.number() coerces "Infinity" through parseFloat; spec numbers are finite on the wire, so the
// string is rejected the way any other non-numeric string is.
let finite = (validator: ValidationType<number>): ValidationType<number> => ({
  ...validator,
  validate: value =>
    typeof value == 'string' && Math.abs(parseFloat(value)) == Infinity
      ? {
          success: false,
          errors: [
            {
              code: 'invalid_type',
              message: 'Invalid input, expected number, received string',
              received: 'string',
              expected: 'number'
            }
          ]
        }
      : validator.validate(value)
});

export let createValidatorFactory = (ir: IR) => {
  let named = new Map<string, ValidationType<any>>();

  let fromNamed = (name: string): ValidationType<any> => {
    let cached = named.get(name);
    if (cached) return cached;

    let type = ir.types[name];
    if (!type) throw new Error(`Unknown type ${name}`);

    let resolved: ValidationType<any> | undefined;
    let lazy: ValidationType<any> = {
      type: 'lazy',
      name,
      validate: value => resolved!.validate(value)
    };
    named.set(name, lazy);

    resolved = buildNamed(type);
    return lazy;
  };

  let shape = (fields: IRField[]) =>
    Object.fromEntries(
      fields.map(field => {
        let validator = fromType(field.type);
        return [field.name, field.optional ? v.optional(validator) : validator];
      })
    );

  let buildNamed = (type: IRNamedType): ValidationType<any> => {
    switch (type.kind) {
      case 'object':
        return v.object(shape(type.fields));

      case 'enum':
        return v.enumOf(type.values);

      case 'alias':
        return fromType(type.type);

      case 'union': {
        let variants = type.variants.map(variant => {
          let body = ir.types[variant.type];
          if (body?.kind != 'object')
            throw new Error(`Union variant ${variant.type} is not an object`);

          return v.object({
            [type.discriminator]: v.literal(variant.tag),
            ...shape(body.fields)
          });
        });

        return v.union(variants as [ValidationType<any>, ValidationType<any>]);
      }
    }
  };

  let fromType = (type: IRType): ValidationType<any> => {
    switch (type.kind) {
      case 'ref':
        return fromNamed(type.name);

      case 'nullable':
        return v.nullable(fromType(type.type));

      case 'string': {
        let modifiers: ValidationModifier<string>[] = [];
        if (type.minLength !== undefined) modifiers.push(v.minLength(type.minLength));
        if (type.maxLength !== undefined) modifiers.push(v.maxLength(type.maxLength));
        if (type.pattern !== undefined) modifiers.push(v.regex(new RegExp(type.pattern)));
        if (type.format == 'email') modifiers.push(v.email());
        if (type.format == 'url') modifiers.push(v.url());
        return v.string({ modifiers });
      }

      case 'int':
        return finite(
          v.number({
            modifiers: [
              v.integer(),
              v.minValue(type.min ?? -maxSafeInteger),
              v.maxValue(type.max ?? maxSafeInteger)
            ]
          })
        );

      case 'number': {
        let modifiers: ValidationModifier<number>[] = [];
        if (type.min !== undefined) modifiers.push(v.minValue(type.min));
        if (type.max !== undefined) modifiers.push(v.maxValue(type.max));
        return finite(v.number({ modifiers }));
      }

      case 'boolean':
        return v.boolean();

      case 'datetime':
        return v.date();

      case 'bytes':
        return v.string();

      case 'json':
      case 'void':
        return v.any();

      case 'literal':
        return v.literal(type.value);

      case 'array': {
        let modifiers: ValidationModifier<any[]>[] = [];
        if (type.minLength !== undefined) modifiers.push(v.minLength(type.minLength));
        if (type.maxLength !== undefined) modifiers.push(v.maxLength(type.maxLength));
        return v.array(fromType(type.items), { modifiers });
      }

      case 'record':
        return v.record(fromType(type.values));
    }
  };

  return {
    type: fromType,
    named: fromNamed,
    methodInput: (methodName: string) => {
      let method = ir.methods.find(m => m.name == methodName);
      if (!method) throw new Error(`Unknown method ${methodName}`);
      return fromType(method.input);
    }
  };
};
