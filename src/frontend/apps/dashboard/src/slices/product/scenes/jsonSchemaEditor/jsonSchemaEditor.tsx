import { CodeEditor } from '@metorial/code-editor';
import { Checkbox, Error, Input, InputLabel, Select, theme } from '@metorial/ui';
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

export let JsonSchemaEditor = ({
  schema,
  value: initialValue,
  onChange,
  label,
  variant
}: {
  schema: JSONSchema7;
  value: any;
  onChange: (value: any) => any;
  label?: string;
  variant?: 'input' | 'raw';
}) => {
  if (schema.type != 'object') return null;

  let properties = schema.properties ?? {};
  let required = schema.required ?? [];

  let [value, setValue] = useState<any>(() => initialValue);
  useEffect(() => {
    if (initialValue != value) setValue(initialValue);
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
  updateField
}: {
  fieldKey: string;
  property: JSONSchema7;
  isRequired: boolean;
  value: any;
  updateField: (key: string, value: any) => void;
}) => {
  let [invalidJson, setInvalidJson] = useState(false);

  let label = (property.title ?? key) + (isRequired ? ' *' : '');

  if (property.type == 'object' || property.type == undefined || property.type == 'array') {
    return (
      <FieldWrapper>
        <CodeEditor
          label={label}
          description={property.description}
          height="200px"
          value={JSON.stringify(value[key] ?? {}, null, 2)}
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
          checked={value[key] ?? false}
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
          value={value[key] ?? ''}
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

  return (
    <FieldWrapper>
      <Input
        label={label}
        description={property.description}
        type={property.type == 'string' ? 'text' : 'number'}
        value={value[key] ?? ''}
        autoFocus
        onChange={e => {
          let value: any = String(e.target.value);

          if (property.type == 'number') {
            value = parseFloat(value);
            if (isNaN(value)) return;
          } else if (property.type == 'integer') {
            value = parseInt(value);
            if (isNaN(value)) return;
          }

          updateField(key, value);
        }}
      />
    </FieldWrapper>
  );
};
