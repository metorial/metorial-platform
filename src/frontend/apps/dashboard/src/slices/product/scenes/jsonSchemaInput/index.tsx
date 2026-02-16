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
  value: any;
  onChange: (value: any) => any;
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

  let [value, setValue] = useState<any>(() => {
    let initial = initialValue ?? {};

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
      let merged = initialValue ?? {};

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

  let updateField = (key: string, newValue: any) => {
    setValue((oldValue: any) => {
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
  value: any;
  updateField: (key: string, value: any) => void;
  depth?: number;
}) => {
  let [invalidJson, setInvalidJson] = useState(false);

  let label = (property.title ?? key) + (isRequired ? ' *' : '');

  if (property.type === 'object' && property.properties) {
    let nestedProperties = property.properties;
    let nestedRequired = property.required ?? [];
    let nestedValue = value[key] ?? {};

    let updateNestedField = (nestedKey: string, newValue: any) => {
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
          <AccordionSingle
            title={label}
            defaultOpen={depth === 0}
          >
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
    (property.items as JSONSchema7).type === 'string'
  ) {
    return (
      <FieldWrapper>
        <TextArrayInput
          label={label}
          description={property.description}
          value={value[key] ?? []}
          onChange={v => updateField(key, v)}
          placeholder={Array.isArray((property.items as Record<string, unknown>)?.examples) ? String(((property.items as Record<string, unknown>).examples as unknown[])[0] ?? 'Enter a value') : 'Enter a value'}
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
    return (
      <FieldWrapper>
        <Checkbox
          label={label}
          description={property.description}
          checked={value[key] ?? property.default ?? false}
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
          value={value[key] ?? property.default ?? ''}
          items={property.enum.map((v: any) => ({
            id: v,
            label: v
          }))}
          onChange={v => updateField(key, v)}
          placeholder="Select an option"
        />
      </FieldWrapper>
    );
  }

  let inputType: 'text' | 'number' | 'password' = 'text';
  if (property.type === 'string') {
    if ((property as any).format === 'password') {
      inputType = 'password';
    }
  } else if (property.type === 'number' || property.type === 'integer') {
    inputType = 'number';
  }

  return (
    <FieldWrapper>
      <Input
        label={label}
        description={property.description}
        type={inputType}
        value={value[key] ?? property.default ?? ''}
        onChange={e => {
          let val: any = String(e.target.value);

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
    </FieldWrapper>
  );
};
