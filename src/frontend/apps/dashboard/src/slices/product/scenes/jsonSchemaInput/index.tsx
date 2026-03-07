import { CodeEditor } from '@metorial/code-editor';
import {
  AccordionSingle,
  Button,
  Checkbox,
  Error,
  Input,
  InputLabel,
  Select,
  Tabs,
  Text,
  TextArrayInput,
  theme
} from '@metorial/ui';
import { JSONSchema7 } from 'json-schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

type JsonSchemaInputValue = Record<string, unknown>;
type JsonSchemaPrimitive = string | number | boolean | null;
type GenericObjectEntryType = 'string' | 'number' | 'boolean' | 'json';
type GenericObjectEntry = {
  id: string;
  key: string;
  type: GenericObjectEntryType;
  value: string;
};

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let toRecord = (value: unknown): JsonSchemaInputValue => (isRecord(value) ? value : {});

let createGenericObjectEntryId = () => Math.random().toString(36).slice(2, 10);

let formatGenericObjectTabLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\bJson\b/g, 'JSON')
    .replace(/\bOauth\b/g, 'OAuth')
    .replace(/\bUri\b/g, 'URI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bId\b/g, 'ID')
    .replace(/\b\w/g, letter => letter.toUpperCase());

let formatSchemaFieldLabel = (value: string) => formatGenericObjectTabLabel(value);

let isJsonStringField = (p: {
  key: string;
  property: JSONSchema7;
}) => {
  if (p.property.type !== 'string') return false;
  if (p.property.format === 'password') return false;

  let haystack = [p.key, p.property.title, p.property.description]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');

  return /\bjson\b/i.test(haystack);
};

let getGenericObjectEntryType = (value: unknown): GenericObjectEntryType => {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'json';
};

let toGenericObjectEntries = (value: unknown): GenericObjectEntry[] => {
  let record = toRecord(value);

  return Object.entries(record).map(([key, entryValue]) => ({
    id: createGenericObjectEntryId(),
    key,
    type: getGenericObjectEntryType(entryValue),
    value:
      typeof entryValue === 'string'
        ? entryValue
        : typeof entryValue === 'number' || typeof entryValue === 'boolean'
          ? String(entryValue)
          : JSON.stringify(entryValue ?? null, null, 2)
  }));
};

let parseGenericObjectEntry = (entry: GenericObjectEntry) => {
  if (entry.type === 'string') {
    return { valid: true as const, value: entry.value };
  }

  if (entry.type === 'number') {
    let trimmed = entry.value.trim();
    if (!trimmed) return { valid: false as const, error: 'Enter a number.' };

    let parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      return { valid: false as const, error: 'Enter a valid number.' };
    }

    return { valid: true as const, value: parsed };
  }

  if (entry.type === 'boolean') {
    return { valid: true as const, value: entry.value === 'true' };
  }

  try {
    return { valid: true as const, value: JSON.parse(entry.value || 'null') };
  } catch (error) {
    return { valid: false as const, error: 'Enter valid JSON.' };
  }
};

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
  display: flex;
  flex-direction: column;
  gap: 12px;
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

let GenericObjectLayout = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
`;

let GenericObjectEditor = styled.div`
  padding: 16px;
  background: ${theme.colors.gray100};
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let GenericObjectPreview = styled.div`
  padding: 16px;
  background: ${theme.colors.background};
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let GenericObjectEntryLabels = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(140px, 0.8fr) auto;
  gap: 10px;
  align-items: center;
  color: ${theme.colors.gray700};
  font-size: 12px;
  font-weight: 600;

  @media (max-width: 720px) {
    display: none;
  }
`;

let GenericObjectHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

let GenericObjectEntries = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let GenericObjectEntryCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.background};
`;

let GenericObjectEntryTop = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(140px, 0.8fr) auto;
  gap: 10px;
  align-items: center;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let GenericObjectEmptyState = styled.div`
  border: 1px dashed ${theme.colors.gray400};
  border-radius: 8px;
  padding: 18px;
  text-align: center;
  color: ${theme.colors.gray600};
  font-size: 14px;
`;

let GenericObjectValueLabel = styled.div`
  color: ${theme.colors.gray700};
  font-size: 12px;
  font-weight: 600;
`;

let GenericObjectTabs = styled.div`
  display: inline-flex;
  width: fit-content;
  margin-top: 8px;
  margin-left: 10px;
  margin-bottom: 8px;
  
  & > div {
    width: auto !important;
  }

  & > div > div:first-child {
    width: auto !important;
    justify-content: flex-start;
    overflow: visible;
    padding-bottom: 6px !important;
    margin-bottom: 0 !important;
  }

  & > div > div:first-child > ul {
    width: auto !important;
    max-width: none !important;
  }

  & li {
    z-index: 2 !important;
  }

  & > div > div:nth-child(3) {
    z-index: 1 !important;
  }
`;

let isGenericObjectProperty = (property: JSONSchema7 | boolean) =>
  typeof property === 'object' &&
  property.type === 'object' &&
  !property.properties;

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
  let genericObjectFields = Object.entries(properties).filter(([, property]) =>
    isGenericObjectProperty(property)
  );
  let nonGenericFields = Object.entries(properties).filter(([, property]) =>
    typeof property === 'object' && !isGenericObjectProperty(property)
  );

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

  let [currentGenericField, setCurrentGenericField] = useState(genericObjectFields[0]?.[0] ?? '');

  useEffect(() => {
    if (!genericObjectFields.length) return;
    if (genericObjectFields.some(([key]) => key === currentGenericField)) return;

    setCurrentGenericField(genericObjectFields[0]![0]);
  }, [currentGenericField, genericObjectFields]);

  let activeGenericField =
    genericObjectFields.find(([key]) => key === currentGenericField) ?? genericObjectFields[0];

  let inner = (
    <Inner>
      {nonGenericFields.map(([key, property], i) => {
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

      {genericObjectFields.length > 0 && activeGenericField && (
        <FieldWrapper>
          {genericObjectFields.length > 1 && (
            <GenericObjectTabs>
              <Tabs
                current={activeGenericField[0]}
                action={setCurrentGenericField}
                tabs={genericObjectFields.map(([key, property]) => ({
                  id: key,
                  label: formatGenericObjectTabLabel(property.title ?? key)
                }))}
                gap={20}
                margin={{ top: 0, bottom: 10 }}
                maxWidth="fit-content"
              />
            </GenericObjectTabs>
          )}

          <RenderField
            fieldKey={activeGenericField[0]}
            property={activeGenericField[1]}
            isRequired={required.includes(activeGenericField[0])}
            value={value}
            updateField={updateField}
            hideLabel={genericObjectFields.length > 1}
          />
        </FieldWrapper>
      )}
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

let GenericObjectInput = ({
  label,
  description,
  value: initialValue,
  onChange,
  hideLabel = false
}: {
  label: string;
  description?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  hideLabel?: boolean;
}) => {
  let initialSerialized = JSON.stringify(toRecord(initialValue));
  let [entries, setEntries] = useState<GenericObjectEntry[]>(() => toGenericObjectEntries(initialValue));
  let onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setEntries(toGenericObjectEntries(initialValue));
  }, [initialSerialized]);

  let validation = useMemo(() => {
    let keyCounts = new Map<string, number>();
    entries.forEach(entry => {
      let key = entry.key.trim();
      if (!key) return;
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    });

    let errors: Record<string, string> = {};
    let output: Record<string, unknown> = {};

    entries.forEach(entry => {
      let key = entry.key.trim();
      if (!key) return;

      if ((keyCounts.get(key) ?? 0) > 1) {
        errors[entry.id] = 'Property names must be unique.';
        return;
      }

      let parsed = parseGenericObjectEntry(entry);
      if (!parsed.valid) {
        errors[entry.id] = parsed.error;
        return;
      }

      output[key] = parsed.value;
    });

    return {
      errors,
      output,
      hasErrors: Object.keys(errors).length > 0
    };
  }, [entries]);

  let outputSerialized = useMemo(() => JSON.stringify(validation.output), [validation.output]);
  let lastEmittedValue = useRef(outputSerialized);

  useEffect(() => {
    if (validation.hasErrors) return;
    if (lastEmittedValue.current === outputSerialized) return;

    lastEmittedValue.current = outputSerialized;
    onChangeRef.current(JSON.parse(outputSerialized));
  }, [outputSerialized, validation.hasErrors]);

  let updateEntry = (id: string, patch: Partial<GenericObjectEntry>) => {
    setEntries(current => current.map(entry => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  let previewLabel = formatGenericObjectTabLabel(label.replace(/\s+\*$/, ''));

  return (
    <FieldWrapper>
      {!hideLabel && <InputLabel>{label}</InputLabel>}
      {description && (
        <Text size="1" color="gray600" style={{ marginBottom: 8 }}>
          {description}
        </Text>
      )}

      <GenericObjectLayout>
        <GenericObjectEditor>
          <GenericObjectHeader>
            <Text size="2" weight="strong">
              Properties
            </Text>

            <Button
              type="button"
              size="1"
              variant="outline"
              onClick={() =>
                setEntries(current => [
                  ...current,
                  {
                    id: createGenericObjectEntryId(),
                    key: '',
                    type: 'string',
                    value: ''
                  }
                ])
              }
            >
              Add Property
            </Button>
          </GenericObjectHeader>

          {entries.length === 0 ? (
            <GenericObjectEmptyState>No properties defined yet.</GenericObjectEmptyState>
          ) : (
            <GenericObjectEntries>
              <GenericObjectEntryLabels>
                <div>Property Name</div>
                <div>Type</div>
                <div />
              </GenericObjectEntryLabels>

              {entries.map(entry => (
                <GenericObjectEntryCard key={entry.id}>
                  <GenericObjectEntryTop>
                    <Input
                      label="Property Name"
                      hideLabel
                      size="2"
                      value={entry.key}
                      placeholder="Property name"
                      onChange={e => updateEntry(entry.id, { key: e.target.value })}
                    />

                    <Select
                      label="Type"
                      hideLabel
                      size="2"
                      value={entry.type}
                      onChange={value =>
                        updateEntry(entry.id, {
                          type: value as GenericObjectEntryType,
                          value:
                            value === 'boolean'
                              ? 'true'
                              : value === 'json'
                                ? entry.type === 'json' ? entry.value : '{}'
                                : entry.type === 'boolean'
                                  ? ''
                                  : entry.value
                        })
                      }
                      items={[
                        { id: 'string', label: 'String' },
                        { id: 'number', label: 'Number' },
                        { id: 'boolean', label: 'Boolean' },
                        { id: 'json', label: 'JSON' }
                      ]}
                    />

                    <Button
                      type="button"
                      size="1"
                      variant="outline"
                      onClick={() =>
                        setEntries(current => current.filter(currentEntry => currentEntry.id !== entry.id))
                      }
                    >
                      Remove
                    </Button>
                  </GenericObjectEntryTop>

                  <GenericObjectValueLabel>Value</GenericObjectValueLabel>

                  {entry.type === 'boolean' ? (
                    <Select
                      label="Value"
                      hideLabel
                      size="2"
                      value={entry.value || 'true'}
                      onChange={value => updateEntry(entry.id, { value })}
                      items={[
                        { id: 'true', label: 'True' },
                        { id: 'false', label: 'False' }
                      ]}
                    />
                  ) : entry.type === 'json' ? (
                    <CodeEditor
                      lang="json"
                      height="120px"
                      value={entry.value}
                      onChange={value => updateEntry(entry.id, { value })}
                    />
                  ) : (
                    <Input
                      label="Value"
                      hideLabel
                      size="2"
                      type={entry.type === 'number' ? 'number' : 'text'}
                      value={entry.value}
                      placeholder={entry.type === 'number' ? '0' : 'Value'}
                      onChange={e => updateEntry(entry.id, { value: e.target.value })}
                    />
                  )}

                  {validation.errors[entry.id] && (
                    <Error>{validation.errors[entry.id]}</Error>
                  )}
                </GenericObjectEntryCard>
              ))}
            </GenericObjectEntries>
          )}
        </GenericObjectEditor>

        <GenericObjectPreview>
          <Text size="2" weight="strong">
            {`${previewLabel} Preview`}
          </Text>

          <CodeEditor
            readOnly
            lang="json"
            height="140px"
            value={JSON.stringify(validation.output, null, 2)}
          />
        </GenericObjectPreview>
      </GenericObjectLayout>
    </FieldWrapper>
  );
};

let RenderField = ({
  fieldKey: key,
  property,
  isRequired,
  value,
  updateField,
  hideLabel = false,
  depth = 0
}: {
  fieldKey: string;
  property: JSONSchema7;
  isRequired: boolean;
  value: JsonSchemaInputValue;
  updateField: (key: string, value: unknown) => void;
  hideLabel?: boolean;
  depth?: number;
}) => {
  let [invalidJson, setInvalidJson] = useState(false);

  let baseLabel = property.title ?? formatSchemaFieldLabel(key);
  let label = baseLabel + (isRequired ? ' *' : '');

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

  if (property.type === 'object') {
    return (
      <GenericObjectInput
        label={label}
        description={property.description}
        value={value[key]}
        onChange={newValue => updateField(key, newValue)}
        hideLabel={hideLabel}
      />
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

  if (property.type == undefined || property.type == 'array') {
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

  let renderAsTextarea = isJsonStringField({ key, property });

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
            type={renderAsTextarea ? undefined : inputType}
            as={renderAsTextarea ? 'textarea' : undefined}
            minRows={renderAsTextarea ? 10 : undefined}
            style={renderAsTextarea ? { fontFamily: 'monospace' } : undefined}
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
