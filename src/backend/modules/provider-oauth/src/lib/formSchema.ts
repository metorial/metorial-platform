import { v, ValidationTypeValue } from '@metorial/validation';

export let formSchema = v.object({
  fields: v.array(
    v.union([
      v.object({
        type: v.enumOf(['text', 'password']),
        label: v.string(),
        key: v.string(),
        isRequired: v.optional(v.boolean()),
        placeholder: v.optional(v.string())
      }),
      v.object({
        type: v.literal('select'),
        label: v.string(),
        key: v.string(),
        isRequired: v.optional(v.boolean()),
        options: v.array(
          v.object({
            label: v.string(),
            value: v.string()
          })
        )
      })
    ])
  )
});

export type AuthForm = ValidationTypeValue<typeof formSchema>;
