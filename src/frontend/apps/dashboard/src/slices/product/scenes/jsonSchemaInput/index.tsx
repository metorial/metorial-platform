import { CodeEditor } from '@metorial/code-editor';
import {
  AccordionSingle,
  Checkbox,
  Error,
  Input,
  InputLabel,
  Select,
  Text,
  TextArrayInput,
  theme
} from '@metorial/ui';
import { JSONSchema7 } from 'json-schema';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

type JsonSchemaInputValue = Record<string, unknown>;
type JsonSchemaPrimitive = string | number | boolean | null;

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let toRecord = (value: unknown): JsonSchemaInputValue => (isRecord(value) ? value : {});

let getEnumItems = (values: JSONSchema7['enum']) =>
  (values ?? [])
    .filter(
      (value): value is JsonSchemaPrimitive =>
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    )
    .map(value => ({
      id: JSON.stringify(value),
      label: String(value),
      value
    }));

let Wrapper = styled.div`
  padding: 18px 20px 20px 20px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 0 10px ${theme.colors.gray300};
`;

let Inner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let FieldWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

let NestedWrapper = styled.div`
  padding: 12px 16px 16px 16px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export let JsonSchemaInput = ({
  schema,
  value: initialValue,
  onChange,
  label,
  variant
}: {
  schema: JSONSchema7 | null | undefined;
  value: JsonSchemaInputValue;
  onChange: (value: JsonSchemaInputValue) => unknown;
  label?: string;
  variant?: 'input' | 'raw';
}) => {
  if (!schema) {
    return (
      <>
        {label && <InputLabel>{label}</InputLabel>}
        <Text size="2" color="gray600">
          No schema defined for this configuration.
        </Text>
      </>
    );
  }

  if (schema.type != 'object') return null;

  let properties = schema.properties ?? {};
  let required = schema.required ?? [];

  let [value, setValue] = useState<JsonSchemaInputValue>(() => {
    let initial = { ...toRecord(initialValue) };

    Object.entries(properties).forEach(([key, property]) => {
      if (
        typeof property === 'object' &&
        property.default !== undefined &&
        initial[key] === undefined
      ) {
        initial[key] = property.default;
      }
    });
    return initial;
  });

  useEffect(() => {
    if (initialValue != value) {
      let merged = { ...toRecord(initialValue) };

      Object.entries(properties).forEach(([key, property]) => {
        if (
          typeof property === 'object' &&
          property.default !== undefined &&
          merged[key] === undefined
        ) {
          merged[key] = property.default;
        }
      });
      setValue(merged);
    }
  }, [initialValue]);

  let updateField = (key: string, newValue: unknown) => {
    setValue(oldValue => {
      let newObject = { ...oldValue, [key]: newValue };
      setTimeout(() => onChange(newObject), 0);
      return newObject;
    });
  };

  let inner = (
    <Inner>
      {Object.entries(properties).map(([key, property], i) => {
        if (typeof property != 'object') return null;

        let isRequired = required.includes(key);

        return (
          <RenderField
            key={i}
            fieldKey={key}
            property={property}
            isRequired={isRequired}
            value={value}
            updateField={updateField}
          />
        );
      })}
    </Inner>
  );

  if (variant == 'raw') return inner;

  return (
    <>
      {label && <InputLabel>{label}</InputLabel>}

      <Wrapper>{inner}</Wrapper>
    </>
  );
};

let RenderField = ({
  fieldKey: key,
  property,
  isRequired,
  value,
  updateField,
  depth = 0
}: {
  fieldKey: string;
  property: JSONSchema7;
  isRequired: boolean;
  value: JsonSchemaInputValue;
  updateField: (key: string, value: unknown) => void;
  depth?: number;
}) => {
  let [invalidJson, setInvalidJson] = useState(false);

  let label = (property.title ?? key) + (isRequired ? ' *' : '');

  if (property.type === 'object' && property.properties) {
    let nestedProperties = property.properties;
    let nestedRequired = property.required ?? [];
    let nestedValue = toRecord(value[key]);

    let updateNestedField = (nestedKey: string, newValue: unknown) => {
      updateField(key, { ...nestedValue, [nestedKey]: newValue });
    };

    Object.entries(nestedProperties).forEach(([nestedKey, nestedProp]) => {
      if (
        typeof nestedProp === 'object' &&
        nestedProp.default !== undefined &&
        nestedValue[nestedKey] === undefined
      ) {
        nestedValue[nestedKey] = nestedProp.default;
      }
    });

    let nestedContent = (
      <NestedWrapper>
        {Object.entries(nestedProperties).map(([nestedKey, nestedProp], i) => {
          if (typeof nestedProp !== 'object') return null;
          return (
            <RenderField
              key={i}
              fieldKey={nestedKey}
              property={nestedProp}
              isRequired={nestedRequired.includes(nestedKey)}
              value={nestedValue}
              updateField={updateNestedField}
              depth={depth + 1}
            />
          );
        })}
      </NestedWrapper>
    );

    if (depth > 0 || Object.keys(nestedProperties).length > 3) {
      return (
        <FieldWrapper>
          <AccordionSingle title={label} defaultOpen={depth === 0}>
            {nestedContent}
          </AccordionSingle>
        </FieldWrapper>
      );
    }

    return (
      <FieldWrapper>
        <InputLabel>{label}</InputLabel>
        {property.description && (
          <Text size="1" color="gray600" style={{ marginBottom: 8 }}>
            {property.description}
          </Text>
        )}
        {nestedContent}
      </FieldWrapper>
    );
  }

  if (
    property.type === 'array' &&
    property.items &&
    typeof property.items === 'object' &&
    !Array.isArray(property.items) &&
    property.items.type === 'string'
  ) {
    let itemExamples = Array.isArray(property.items.examples) ? property.items.examples : [];
    let arrayValue = Array.isArray(value[key])
      ? value[key].filter((item): item is string => typeof item === 'string')
      : [];

    return (
      <FieldWrapper>
        <TextArrayInput
          label={label}
          description={property.description}
          value={arrayValue}
          onChange={v => updateField(key, v)}
          placeholder={
            itemExamples.length > 0
              ? String(itemExamples[0] ?? 'Enter a value')
              : 'Enter a value'
          }
        />
      </FieldWrapper>
    );
  }

  if (property.type == 'object' || property.type == undefined || property.type == 'array') {
    return (
      <FieldWrapper>
        <CodeEditor
          label={label}
          description={property.description}
          height="200px"
          value={JSON.stringify(value[key] ?? (property.type === 'array' ? [] : {}), null, 2)}
          onChange={v => {
            try {
              updateField(key, JSON.parse(v));
              setInvalidJson(false);
            } catch (e) {
              setInvalidJson(true);
            }
          }}
        />

        {invalidJson && (
          <Error style={{ marginTop: 5 }}>
            The JSON you provided is invalid. Please check the syntax.
          </Error>
        )}
      </FieldWrapper>
    );
  }

  if (property.type == 'boolean') {
    let checkedValue =
      typeof value[key] === 'boolean'
        ? value[key]
        : typeof property.default === 'boolean'
          ? property.default
          : false;

    return (
      <FieldWrapper>
        <Checkbox
          label={label}
          description={property.description}
          checked={checkedValue}
          onCheckedChange={v => updateField(key, v)}
        />
      </FieldWrapper>
    );
  }

  if (property.type == 'null') return null;

  if (property.type == 'string' && property.enum) {
    return (
      <FieldWrapper>
        <Select
          label={label}
          description={property.description}
          value={
            getEnumItems(property.enum).find(option =>
              Object.is(option.value, value[key] ?? property.default)
            )?.id ?? ''
          }
          items={getEnumItems(property.enum).map(option => ({
            id: option.id,
            label: option.label
          }))}
          onChange={selectedId => {
            let selectedOption = getEnumItems(property.enum).find(option => option.id === selectedId);
            updateField(key, selectedOption?.value ?? property.default ?? '');
          }}
          placeholder="Select an option"
        />
      </FieldWrapper>
    );
  }

  let inputType: 'text' | 'number' | 'password' = 'text';
  if (property.type === 'string' && property.format === 'password') {
    inputType = 'password';
  } else if (property.type === 'number' || property.type === 'integer') {
    inputType = 'number';
  }

  return (
    <FieldWrapper>
      {(() => {
        let currentValue = value[key] ?? property.default ?? '';
        let inputValue =
          typeof currentValue === 'string' || typeof currentValue === 'number'
            ? currentValue
            : '';

        return (
      <Input
        label={label}
        description={property.description}
        type={inputType}
        value={inputValue}
        onChange={e => {
          let val: string | number = e.target.value;

          if (property.type == 'number') {
            val = parseFloat(val);
            if (isNaN(val)) return;
          } else if (property.type == 'integer') {
            val = parseInt(val);
            if (isNaN(val)) return;
          }

          updateField(key, val);
        }}
      />
        );
      })()}
    </FieldWrapper>
  );
};
