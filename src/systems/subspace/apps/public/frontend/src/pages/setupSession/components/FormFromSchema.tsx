import { Checkbox, Flex, Input, Select } from '@metorial-io/ui';
import React from 'react';
import type { FieldDefinition, JsonSchema } from '../../../lib/jsonSchema';
import { schemaToFields } from '../../../lib/jsonSchema';

interface FormFromSchemaProps {
  schema: JsonSchema;
  form: {
    values: Record<string, unknown>;
    errors: Record<string, string | undefined>;
    touched: Record<string, boolean | undefined>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
    setFieldValue: (field: string, value: unknown) => void;
  };
  RenderError: React.ComponentType<{ field: string }>;
}

export let FormFromSchema = ({ schema, form, RenderError }: FormFromSchemaProps) => {
  let fields = schemaToFields(schema);

  if (fields.length === 0) {
    return null;
  }

  return (
    <Flex direction="column" gap={16}>
      {fields.map(field => (
        <FormField key={field.key} field={field} form={form} RenderError={RenderError} />
      ))}
    </Flex>
  );
};

interface FormFieldProps {
  field: FieldDefinition;
  form: FormFromSchemaProps['form'];
  RenderError: React.ComponentType<{ field: string }>;
}

let getDescription = (field: FieldDefinition) => {
  let desc = field.description;
  if (!desc || desc.length <= 5) return undefined;
  if (field.placeholder && desc.toLowerCase() === field.placeholder.toLowerCase())
    return undefined;
  return desc;
};

let FormField = ({ field, form, RenderError }: FormFieldProps) => {
  let value = form.values[field.key];
  let description = getDescription(field);

  if (field.type === 'select' && field.options) {
    return (
      <div>
        <Select
          label={field.required ? `${field.label} *` : field.label}
          description={description}
          value={value as string}
          onChange={val => form.setFieldValue(field.key, val)}
          placeholder="Select..."
          items={field.options.map(opt => ({ id: opt.value, label: opt.label }))}
        />
        <RenderError field={field.key} />
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div>
        <Checkbox
          label={field.required ? `${field.label} *` : field.label}
          description={description}
          checked={value as boolean}
          onCheckedChange={checked => form.setFieldValue(field.key, checked)}
        />
        <RenderError field={field.key} />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <Input
          as="textarea"
          label={field.required ? `${field.label} *` : field.label}
          description={description}
          value={value as string}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          name={field.key}
          placeholder={field.placeholder}
          minRows={3}
          maxRows={8}
        />
        <RenderError field={field.key} />
      </div>
    );
  }

  return (
    <div>
      <Input
        label={field.required ? `${field.label} *` : field.label}
        description={description}
        type={field.type}
        value={value as string}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        name={field.key}
        placeholder={field.placeholder}
        {...field.inputProps}
      />
      <RenderError field={field.key} />
    </div>
  );
};
