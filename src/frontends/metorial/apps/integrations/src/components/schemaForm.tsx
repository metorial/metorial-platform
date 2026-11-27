import { Checkbox, Error, Flex, Input, Select } from '@metorial/ui';
import type { ChangeEvent, FocusEvent } from 'react';
import styled from 'styled-components';
import { schemaToFields, type FieldDefinition, type JsonSchema } from '../lib/jsonSchema';

type SchemaFormState = {
  values: Record<string, unknown>;
  errors: Record<string, string | undefined>;
  touched: Record<string, boolean | undefined>;
  submitCount: number;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (e: FocusEvent<HTMLInputElement>) => void;
  setFieldValue: (field: string, value: unknown) => void;
};

let CheckboxError = styled.div`
  margin-top: 6px;
`;

let getLabel = (field: FieldDefinition) => (field.required ? `${field.label} *` : field.label);

let getDescription = (field: FieldDefinition) => {
  let description = field.description;
  if (!description || description.length <= 5) return undefined;

  let repeatsPlaceholder =
    !!field.placeholder && description.toLowerCase() === field.placeholder.toLowerCase();

  return repeatsPlaceholder ? undefined : description;
};

let getError = (field: FieldDefinition, form: SchemaFormState) => {
  let error = form.errors[field.key];
  let isVisible = form.touched[field.key] || form.submitCount > 0;

  return error && isVisible ? error : undefined;
};

let SchemaField = ({ field, form }: { field: FieldDefinition; form: SchemaFormState }) => {
  let value = form.values[field.key];
  let label = getLabel(field);
  let description = getDescription(field);
  let error = getError(field, form);

  if (field.type === 'select' && field.options) {
    return (
      <Select
        label={label}
        description={description}
        value={value as string}
        onChange={val => form.setFieldValue(field.key, val)}
        placeholder="Select..."
        items={field.options.map(option => ({ id: option.value, label: option.label }))}
        error={error}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div>
        <Checkbox
          label={label}
          description={description}
          checked={value as boolean}
          onCheckedChange={checked => form.setFieldValue(field.key, checked)}
        />

        {error && (
          <CheckboxError>
            <Error size={12}>{error}</Error>
          </CheckboxError>
        )}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <Input
        as="textarea"
        label={label}
        description={description}
        error={error}
        value={value as string}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        name={field.key}
        placeholder={field.placeholder}
        minRows={3}
        maxRows={8}
      />
    );
  }

  return (
    <Input
      label={label}
      description={description}
      type={field.type}
      error={error}
      value={value as string}
      onChange={form.handleChange}
      onBlur={form.handleBlur}
      name={field.key}
      placeholder={field.placeholder}
      {...field.inputProps}
    />
  );
};

export let SchemaForm = ({ schema, form }: { schema: JsonSchema; form: SchemaFormState }) => {
  let fields = schemaToFields(schema);
  if (!fields.length) return null;

  return (
    <Flex direction="column" gap={16}>
      {fields.map(field => (
        <SchemaField key={field.key} field={field} form={form} />
      ))}
    </Flex>
  );
};
