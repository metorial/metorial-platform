import { Button, Checkbox, Input, Select, Text, TextArrayInput, theme } from '@metorial/ui';
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020';
import { getIn, setIn, useFormik } from 'formik';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { MarkdownDescription } from './markdownDescription';

type JsonObject = Record<string, unknown>;

type NamedField = {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
};

let blackButtonStyle = {
  background: String(theme.colors.gray900),
  borderColor: String(theme.colors.gray900),
  color: String(theme.colors.white100)
};

let sanitizeOptionalValues = (
  schema: JSONSchema7 | null | undefined,
  value: unknown,
  required = true
): unknown => {
  if (!schema) return value;

  if (schema.type === 'object' && isObject(value)) {
    let requiredKeys = new Set(schema.required ?? []);
    let nextValue: JsonObject = {};

    for (let [key, propertyValue] of Object.entries(value)) {
      let propertySchema = getSchemaDefinition(schema.properties?.[key]);
      let sanitized = sanitizeOptionalValues(
        propertySchema,
        propertyValue,
        requiredKeys.has(key)
      );

      if (sanitized !== undefined) {
        nextValue[key] = sanitized;
      }
    }

    return nextValue;
  }

  if (schema.type === 'array' && Array.isArray(value)) {
    let itemSchema =
      schema.items && !Array.isArray(schema.items) ? getSchemaDefinition(schema.items) : null;
    let nextValue = itemSchema
      ? value
          .map(item => sanitizeOptionalValues(itemSchema, item, false))
          .filter(item => item !== undefined)
      : value;

    if (!required && nextValue.length === 0) {
      return undefined;
    }

    return nextValue;
  }

  if (!required && value === '') {
    return undefined;
  }

  return value;
};

let Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 15px;
`;

let Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
  padding: 14px;
`;

let SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${theme.colors.gray900};
`;

let SectionDescription = styled(MarkdownDescription)``;

let FieldError = styled.div`
  color: ${theme.colors.red700};
  font-size: 12px;
  margin-top: -4px;
`;

let createAjv = () => {
  let ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateSchema: false
  });

  addFormats(ajv);

  return ajv;
};

let stripSchemaDialect = (schema?: JSONSchema7 | null): JSONSchema7 => {
  let normalized = normalizeSchema(schema);

  if (!('$schema' in normalized)) {
    return normalized;
  }

  let nextSchema = { ...normalized } as JSONSchema7 & { $schema?: string };
  delete nextSchema.$schema;
  return nextSchema;
};

let isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let toObject = (value: unknown): JsonObject => (isObject(value) ? value : {});

let normalizeSchema = (schema?: JSONSchema7 | null): JSONSchema7 => {
  if (!schema || schema.type !== 'object') {
    return { type: 'object', properties: {} };
  }

  return schema;
};

let getSchemaDefinition = (definition?: JSONSchema7Definition): JSONSchema7 | null => {
  if (!definition || typeof definition === 'boolean') return null;
  return definition;
};

let buildInitialValue = (schema?: JSONSchema7 | null): unknown => {
  if (!schema) return undefined;
  if (schema.default !== undefined) return schema.default;

  if (schema.type === 'object') {
    let properties = schema.properties ?? {};
    let value: JsonObject = {};

    Object.entries(properties).forEach(([key, property]) => {
      let propertySchema = getSchemaDefinition(property);
      if (!propertySchema) return;

      let initial = buildInitialValue(propertySchema);
      if (initial !== undefined) value[key] = initial;
    });

    return value;
  }

  if (schema.type === 'array') {
    return [];
  }

  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return '';

  return '';
};

let buildInitialValues = (schema?: JSONSchema7 | null): JsonObject => {
  let normalized = normalizeSchema(schema);
  let properties = normalized.properties ?? {};
  let values: JsonObject = {};

  Object.entries(properties).forEach(([key, property]) => {
    let propertySchema = getSchemaDefinition(property);
    if (!propertySchema) return;
    values[key] = buildInitialValue(propertySchema);
  });

  return values;
};

let toPath = (instancePath: string) =>
  instancePath
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.');

let mapAjvErrors = (errors: any[] | null | undefined) => {
  let mapped: Record<string, unknown> = {};

  for (let error of errors ?? []) {
    let path = toPath(error.instancePath ?? '');

    if (error.keyword === 'required' && error.params?.missingProperty) {
      path = path ? `${path}.${error.params.missingProperty}` : error.params.missingProperty;
    }

    let message = error.message ?? 'Invalid value';
    mapped = setIn(mapped, path || '_form', message);
  }

  return mapped;
};

let mergeErrors = (
  left: Record<string, unknown>,
  right: Record<string, unknown>
): Record<string, unknown> => {
  let merged = { ...left };

  for (let [key, value] of Object.entries(right)) {
    if (isObject(value) && isObject(merged[key])) {
      merged[key] = mergeErrors(merged[key] as Record<string, unknown>, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
};

let validateRequiredFields = (
  schema: JSONSchema7 | null | undefined,
  value: unknown,
  path = ''
): Record<string, unknown> => {
  if (!schema || schema.type !== 'object') {
    return {};
  }

  let errors: Record<string, unknown> = {};
  let requiredKeys = schema.required ?? [];
  let objectValue = isObject(value) ? value : {};

  for (let key of requiredKeys) {
    let propertySchema = getSchemaDefinition(schema.properties?.[key]);
    if (!propertySchema) continue;

    let propertyValue = objectValue[key];
    let propertyPath = path ? `${path}.${key}` : key;

    let isEmpty =
      propertyValue === undefined ||
      propertyValue === null ||
      (typeof propertyValue === 'string' && propertyValue === '') ||
      (Array.isArray(propertyValue) && propertyValue.length === 0);

    if (isEmpty) {
      errors = setIn(errors, propertyPath, 'This field is required.');
      continue;
    }

    if (propertySchema.type === 'object') {
      errors = mergeErrors(
        errors,
        validateRequiredFields(propertySchema, propertyValue, propertyPath)
      );
    }
  }

  return errors;
};

let getError = (
  errors: Record<string, unknown>,
  touched: Record<string, unknown>,
  path: string,
  submitCount: number
) => {
  let wasTouched = getIn(touched, path);
  let error = getIn(errors, path);

  if (!error) return undefined;
  if (wasTouched || submitCount > 0) return error;
  return undefined;
};

let JsonField = ({
  label,
  name,
  description,
  value,
  onChange,
  error
}: {
  label: string;
  name: string;
  description?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) => {
  let [rawValue, setRawValue] = useState(() => JSON.stringify(value ?? {}, null, 2));
  let [localError, setLocalError] = useState<string | undefined>();

  useEffect(() => {
    setRawValue(JSON.stringify(value ?? {}, null, 2));
  }, [value]);

  return (
    <Input
      label={label}
      description={description}
      as="textarea"
      minRows={5}
      value={rawValue}
      onChange={event => {
        let nextValue = event.target.value;
        setRawValue(nextValue);

        try {
          onChange(JSON.parse(nextValue));
          setLocalError(undefined);
        } catch {
          setLocalError('Enter valid JSON.');
        }
      }}
      error={localError ?? error}
      name={name}
    />
  );
};

let renderField = (d: {
  path: string;
  fieldKey: string;
  schema: JSONSchema7;
  required: boolean;
  values: JsonObject;
  errors: Record<string, unknown>;
  touched: Record<string, unknown>;
  submitCount: number;
  setFieldValue: (field: string, value: unknown) => void;
  setFieldTouched: (field: string, touched?: boolean, shouldValidate?: boolean) => void;
  depth?: number;
}): React.ReactNode => {
  let title = d.schema.title ?? d.fieldKey;
  let label = d.required ? `${title} *` : title;
  let description = d.schema.description;
  let fieldValue = getIn(d.values, d.path);
  let error = getError(d.errors, d.touched, d.path, d.submitCount) as string | undefined;
  let depth = d.depth ?? 0;

  if (d.schema.type === 'object' && d.schema.properties) {
    let required = d.schema.required ?? [];

    return (
      <Section key={d.path}>
        <SectionTitle>{label}</SectionTitle>
        {description ? <SectionDescription content={description} /> : null}
        {Object.entries(d.schema.properties).map(([key, property]) => {
          let nestedSchema = getSchemaDefinition(property);
          if (!nestedSchema) return null;

          return renderField({
            ...d,
            path: `${d.path}.${key}`,
            fieldKey: key,
            schema: nestedSchema,
            required: required.includes(key),
            depth: depth + 1
          });
        })}
      </Section>
    );
  }

  if (d.schema.type === 'array' && d.schema.items && !Array.isArray(d.schema.items)) {
    let itemSchema = getSchemaDefinition(d.schema.items);

    if (itemSchema?.type === 'string') {
      let value = Array.isArray(fieldValue)
        ? fieldValue.filter(item => typeof item === 'string')
        : [];

      return (
        <div key={d.path}>
          <TextArrayInput
            label={label}
            description={description}
            value={value}
            onChange={nextValue => d.setFieldValue(d.path, nextValue)}
            error={error}
            autoAdd
          />
        </div>
      );
    }
  }

  if (d.schema.type === 'boolean') {
    return (
      <div key={d.path}>
        <Checkbox
          label={label}
          description={description}
          checked={Boolean(fieldValue)}
          onCheckedChange={checked => d.setFieldValue(d.path, checked)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    );
  }

  if (d.schema.type === 'string' && Array.isArray(d.schema.enum)) {
    return (
      <div key={d.path}>
        <Select
          label={label}
          description={description}
          value={typeof fieldValue === 'string' ? fieldValue : undefined}
          onChange={value => d.setFieldValue(d.path, value)}
          error={error || false}
          items={d.schema.enum.map(item => ({ id: String(item), label: String(item) }))}
        />
      </div>
    );
  }

  if (d.schema.type === 'array' || d.schema.type === 'object' || !d.schema.type) {
    return (
      <div key={d.path}>
        <JsonField
          key={d.path}
          name={d.path}
          label={label}
          description={description}
          value={fieldValue}
          onChange={nextValue => d.setFieldValue(d.path, nextValue)}
          error={error}
        />
      </div>
    );
  }

  let inputType = 'text';
  if (d.schema.type === 'integer' || d.schema.type === 'number') inputType = 'number';
  if (d.schema.type === 'string' && d.schema.format === 'password') inputType = 'password';

  return (
    <div key={d.path}>
      <Input
        label={label}
        description={description}
        type={inputType}
        value={fieldValue as any}
        onChange={event => {
          let nextValue: unknown = event.target.value;

          if (d.schema.type === 'integer') {
            nextValue = event.target.value === '' ? '' : parseInt(event.target.value, 10);
          }

          if (d.schema.type === 'number') {
            nextValue = event.target.value === '' ? '' : parseFloat(event.target.value);
          }

          d.setFieldValue(d.path, nextValue);
        }}
        onBlur={() => d.setFieldTouched(d.path, true, true)}
        error={error}
      />
    </div>
  );
};

export let SchemaForm = ({
  schema,
  onSubmit,
  submitLabel,
  isSubmitting
}: {
  schema?: JSONSchema7 | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
  submitLabel: string;
  isSubmitting?: boolean;
}) => {
  let normalizedSchema = useMemo(() => stripSchemaDialect(schema), [schema]);
  let compiled = useMemo(() => {
    let ajv = createAjv();

    try {
      return {
        validator: ajv.compile(normalizedSchema),
        compileError: null
      };
    } catch (error) {
      return {
        validator: null,
        compileError:
          error instanceof Error ? error.message : 'This schema could not be compiled.'
      };
    }
  }, [normalizedSchema]);

  let formik = useFormik<JsonObject>({
    initialValues: buildInitialValues(normalizedSchema),
    enableReinitialize: true,
    validateOnBlur: true,
    validateOnChange: true,
    validate: values => {
      let sanitizedValues = sanitizeOptionalValues(normalizedSchema, values) as JsonObject;
      let requiredFieldErrors = validateRequiredFields(normalizedSchema, sanitizedValues);

      if (!compiled.validator) {
        return mergeErrors(requiredFieldErrors, {
          _form: compiled.compileError ?? 'This schema could not be compiled.'
        });
      }

      let valid = compiled.validator(sanitizedValues);
      if (valid) return requiredFieldErrors;
      return mergeErrors(requiredFieldErrors, mapAjvErrors(compiled.validator.errors));
    },
    onSubmit: async values => {
      if (!compiled.validator) return;
      let sanitizedValues = sanitizeOptionalValues(normalizedSchema, values) as JsonObject;
      await onSubmit(sanitizedValues);
    }
  });

  let properties = normalizedSchema.properties ?? {};
  let hasFields = Object.keys(properties).length > 0;

  return (
    <Form onSubmit={formik.handleSubmit}>
      {hasFields ? (
        Object.entries(properties).map(([key, property]) => {
          let propertySchema = getSchemaDefinition(property);
          if (!propertySchema) return null;

          return renderField({
            path: key,
            fieldKey: key,
            schema: propertySchema,
            required: (normalizedSchema.required ?? []).includes(key),
            values: formik.values,
            errors: formik.errors,
            touched: formik.touched as Record<string, unknown>,
            submitCount: formik.submitCount,
            setFieldValue: formik.setFieldValue,
            setFieldTouched: formik.setFieldTouched
          });
        })
      ) : (
        <Text size="2" color="gray700">
          This capability does not require any input.
        </Text>
      )}

      {typeof formik.errors._form === 'string' ? (
        <CalloutText>{formik.errors._form}</CalloutText>
      ) : null}

      <div>
        <Button
          type="submit"
          variant="solid"
          color="gray"
          size="2"
          style={blackButtonStyle}
          loading={isSubmitting}
          disabled={!compiled.validator}
        >
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
};

let CalloutText = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  background: ${theme.colors.red100};
  border: 1px solid ${theme.colors.red600};
  color: ${theme.colors.red900};
  font-size: 13px;
`;

export let NamedArgumentsForm = ({
  fields,
  onSubmit,
  submitLabel,
  isSubmitting
}: {
  fields: NamedField[];
  onSubmit: (values: Record<string, string | undefined>) => Promise<void> | void;
  submitLabel: string;
  isSubmitting?: boolean;
}) => {
  let formik = useFormik<Record<string, string>>({
    initialValues: Object.fromEntries(fields.map(field => [field.name, ''])),
    enableReinitialize: true,
    validate: values => {
      let errors: Record<string, string> = {};

      for (let field of fields) {
        if (field.required && !values[field.name]?.trim()) {
          errors[field.name] = 'This field is required.';
        }
      }

      return errors;
    },
    onSubmit: async values => {
      let trimmed = Object.fromEntries(
        fields.map(field => {
          let rawValue = values[field.name] ?? '';
          let normalizedValue = field.required
            ? rawValue.trim()
            : rawValue.trim() || undefined;

          return [field.name, normalizedValue];
        })
      ) as Record<string, string | undefined>;

      await onSubmit(trimmed);
    }
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      {fields.map(field => (
        <Input
          key={field.name}
          label={field.required ? `${field.label} *` : field.label}
          description={field.description}
          value={formik.values[field.name] ?? ''}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          name={field.name}
          error={
            ((formik.touched[field.name] || formik.submitCount > 0) &&
              formik.errors[field.name]) ||
            undefined
          }
        />
      ))}

      <Button
        type="submit"
        variant="solid"
        color="gray"
        style={blackButtonStyle}
        loading={isSubmitting}
      >
        {submitLabel}
      </Button>
    </Form>
  );
};
