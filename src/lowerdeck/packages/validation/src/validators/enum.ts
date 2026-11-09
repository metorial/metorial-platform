import { error } from '../lib/result';
import type { ValidationType } from '../lib/types';

// export let enumType = <
//   A extends string | number | boolean,
//   Rest extends (string | number | boolean)[]
// >(
//   ...values: [A, ...Rest]
// ): ValidationType<A | Rest[number]> => ({
//   type: 'enum',
//   examples: values,
//   validate: value => {
//     if (!values.includes(value)) {
//       return error([
//         {
//           code: 'invalid_enum',
//           message: `Invalid input, expected one of ${values.join(', ')}, received ${value}`,
//           received: value,
//           expected: values
//         }
//       ]);
//     }

//     return { success: true, value };
//   }
// });

export let enumOf = <const Values extends readonly (string | number | boolean)[]>(
  values: Values,
  opts?: {
    name?: string;
    description?: string;
  }
): ValidationType<Values[number]> => ({
  type: 'enum',
  examples: [...values],
  name: opts?.name,
  description: opts?.description,
  validate: value => {
    if (!values.includes(value)) {
      return error([
        {
          code: 'invalid_enum',
          message: `Invalid input, expected one of ${values.join(', ')}, received ${value}`,
          received: value,
          expected: values
        }
      ]);
    }

    return { success: true, value };
  }
});
