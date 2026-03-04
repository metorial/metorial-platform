import {
  DashboardInstanceProvidersToolsListOutput
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderTools } from '@metorial/state';
import { AccordionSingle, Badge, Flex, Spacer, Text, theme } from '@metorial/ui';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { RiArrowDownSLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { styled } from 'styled-components';
import { getJsonSchemaObject } from '../../../lib/jsonSchema';
import { useProviderVersionContext } from './_layout';

type SchemaProperty = JSONSchema7;
type ProviderTool = DashboardInstanceProvidersToolsListOutput['items'][number];
type ToolModeBadge = { label: string; color: 'red' | 'green' };

let isSchemaObject = (
  value: JSONSchema7Definition | JSONSchema7Definition[] | undefined
): value is JSONSchema7 =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let getSchemaType = (prop: SchemaProperty) => {
  let type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  return typeof type === 'string' ? type : 'any';
};

let CollapsibleBox = styled(motion.div)`
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray300};
  overflow: hidden;
  border-radius: 8px;
  margin-top: 4px;
`;

let CollapsibleToggle = styled('button')`
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 0px 10px;
  cursor: pointer;
  height: 28px;
  transition: background 0.2s;
  font-size: 12px;
  font-weight: 500;
  width: 100%;
  color: ${theme.colors.gray700};

  &:hover,
  &:focus {
    background: ${theme.colors.gray200};
  }
`;

let CollapsibleBody = styled(motion.div)`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${theme.colors.gray300};
`;

let getTypeColor = (
  type: string
): 'cyan' | 'green' | 'orange' | 'purple' | 'blue' | 'gray' => {
  switch (type) {
    case 'string':
      return 'cyan';
    case 'number':
    case 'integer':
      return 'blue';
    case 'boolean':
      return 'orange';
    case 'array':
      return 'purple';
    case 'object':
      return 'green';
    default:
      return 'gray';
  }
};

let typeMap: Record<string, string> = {
  string: 'String',
  number: 'Number',
  integer: 'Integer',
  boolean: 'Boolean',
  object: 'Object',
  array: 'Array',
  null: 'Null'
};

let formatType = (type?: string) => typeMap[type || ''] || type || 'Any';

let isNullable = (prop: SchemaProperty): boolean => {
  let variants =
    (Array.isArray(prop.oneOf) ? prop.oneOf : undefined) ||
    (Array.isArray(prop.anyOf) ? prop.anyOf : undefined);
  if (!variants) return false;
  return variants.some(v => typeof v === 'object' && v?.type === 'null');
};

let getNonNullVariants = (prop: SchemaProperty): SchemaProperty[] => {
  let variants =
    (Array.isArray(prop.oneOf) ? prop.oneOf : undefined) ||
    (Array.isArray(prop.anyOf) ? prop.anyOf : undefined);
  if (!variants) return [];
  return variants.filter((v): v is SchemaProperty => typeof v === 'object' && v?.type !== 'null');
};

let getTypeLabel = (prop: SchemaProperty): string => {
  if (prop.enum) return 'Enum';
  if (prop.oneOf || prop.anyOf) {
    let nonNull = getNonNullVariants(prop);
    if (isNullable(prop) && nonNull.length === 1) return formatType(getSchemaType(nonNull[0]));
    let labels = nonNull.map(v => formatType(getSchemaType(v)));
    if (labels.length <= 3) return labels.join(' | ');
    return 'Union';
  }
  if (getSchemaType(prop) === 'array') {
    if (isSchemaObject(prop.items) && prop.items.properties) return 'Array of Objects';
    if (isSchemaObject(prop.items)) return `Array of ${formatType(getSchemaType(prop.items))}s`;
    return 'Array';
  }
  return formatType(getSchemaType(prop));
};

let getCollapsibleLabel = (prop: SchemaProperty): string => {
  if (prop.enum) return 'Possible values';
  if (getSchemaType(prop) === 'array') {
    if (isSchemaObject(prop.items)) {
      let itemType = getSchemaType(prop.items);
      if (itemType !== 'any') return `Array of ${itemType}s`;
      if (prop.items.properties) return 'Array of objects';
    }
    return 'Array items';
  }
  if (getSchemaType(prop) === 'object') return 'Object properties';
  if (prop.oneOf || prop.anyOf) return 'Union types';
  return 'Properties';
};

let getToolModeBadges = (tool: Pick<ProviderTool, 'tags'>) => {
  let badges: ToolModeBadge[] = [];

  if (tool.tags?.destructive) {
    badges.push({ label: 'Destructive', color: 'red' });
  }

  if (tool.tags?.readOnly) {
    badges.push({ label: 'Read-only', color: 'green' });
  }

  return badges;
};

let PropertyList = ({
  properties,
  required = [],
  open,
  setOpen,
  parentId
}: {
  properties: Record<string, JSONSchema7Definition>;
  required?: string[];
  open: string[];
  setOpen: React.Dispatch<React.SetStateAction<string[]>>;
  parentId?: string;
}) => {
  let entries = Object.entries(properties).flatMap(([name, prop]) =>
    isSchemaObject(prop) ? ([[name, prop]] as const) : []
  );
  if (entries.length === 0) return null;

  return (
    <Flex direction="column">
      {entries.map(([name, prop], index) => {
        let id = `${parentId ?? ''}:${name}`;
        let isOpen = open.includes(id);
        let typeLabel = getTypeLabel(prop);
        let typeColor =
          prop.enum || prop.oneOf || prop.anyOf ? 'cyan' : getTypeColor(getSchemaType(prop));

        let nestedProps: Record<string, JSONSchema7Definition> | undefined;
        let nestedRequired: string[] | undefined;
        let collapsibleLabel: string | undefined;

        if (prop.properties && Object.keys(prop.properties).length > 0) {
          nestedProps = prop.properties;
          nestedRequired = prop.required;
          collapsibleLabel = getCollapsibleLabel(prop);
        } else if (
          getSchemaType(prop) === 'array' &&
          isSchemaObject(prop.items) &&
          prop.items.properties &&
          Object.keys(prop.items.properties).length > 0
        ) {
          nestedProps = prop.items.properties;
          nestedRequired = prop.items.required;
          collapsibleLabel = getCollapsibleLabel(prop);
        } else if (prop.oneOf || prop.anyOf) {
          let variants =
            (Array.isArray(prop.oneOf) ? prop.oneOf : undefined) ||
            (Array.isArray(prop.anyOf) ? prop.anyOf : undefined) ||
            [];
          let variant = variants.find(
            (v): v is JSONSchema7 =>
              isSchemaObject(v) && !!v.properties && Object.keys(v.properties).length > 0
          );
          if (variant) {
            nestedProps = variant.properties;
            nestedRequired = variant.required;
            collapsibleLabel = getCollapsibleLabel(prop);
          }
        }

        return (
          <Flex
            key={name}
            direction="column"
            gap={2}
            style={{
              padding: parentId ? '8px 12px' : '6px 0',
              borderBottom:
                index < entries.length - 1
                  ? `1px solid ${theme.colors.gray200}`
                  : undefined
            }}
          >
            <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Text size="2" weight="strong">
                {name}
              </Text>
              <Badge color={typeColor} size="1">
                {typeLabel}
              </Badge>
              {isNullable(prop) && (
                <Badge color="orange" size="1">
                  Nullable
                </Badge>
              )}
              {required.includes(name) ? (
                <Badge color="red" size="1">
                  Required
                </Badge>
              ) : (
                <Badge color="gray" size="1">
                  Optional
                </Badge>
              )}
              {prop.default !== undefined && (
                <Text size="1" color="gray600">
                  default: {JSON.stringify(prop.default)}
                </Text>
              )}
            </Flex>
            {prop.description && (
              <Text size="1" color="gray600">
                {prop.description}
              </Text>
            )}
            {prop.enum && (
              <Text size="1" color="gray600">
                Values: {prop.enum.join(', ')}
              </Text>
            )}
            {nestedProps && collapsibleLabel && (
              <CollapsibleBox
                animate={{ width: isOpen ? '100%' : 'fit-content' }}
                style={{ width: 'fit-content' }}
                transition={{ duration: 0.15 }}
              >
                <CollapsibleToggle
                  onClick={() =>
                    setOpen(o => (isOpen ? o.filter(x => x !== id) : [...o, id]))
                  }
                >
                  <RiArrowDownSLine
                    size={14}
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : '',
                      transition: 'transform 0.2s',
                      opacity: isOpen ? 0.65 : 0.5
                    }}
                  />
                  <span>{collapsibleLabel}</span>
                </CollapsibleToggle>
                <AnimatePresence>
                  {isOpen && (
                    <CollapsibleBody
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      style={{ overflow: 'hidden' }}
                      transition={{ duration: 0.1 }}
                    >
                      <PropertyList
                        properties={nestedProps}
                        required={nestedRequired}
                        open={open}
                        setOpen={setOpen}
                        parentId={id}
                      />
                    </CollapsibleBody>
                  )}
                </AnimatePresence>
              </CollapsibleBox>
            )}
          </Flex>
        );
      })}
    </Flex>
  );
};

let SchemaViewer = ({
  schema,
  title
}: {
  schema: ReturnType<typeof getJsonSchemaObject>;
  title: string;
}) => {
  let [open, setOpen] = useState<string[]>([]);

  if (!schema?.properties) return null;
  let properties = schema.properties || {};
  let required = schema.required || [];
  let entries = Object.entries(properties);

  if (entries.length === 0) return null;

  return (
    <div>
      <Text size="2" weight="strong" style={{ display: 'block', marginBottom: 4 }}>
        {title}
      </Text>
      <PropertyList
        properties={properties}
        required={required}
        open={open}
        setOpen={setOpen}
      />
    </div>
  );
};

export let ProviderToolsPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId } = useProviderVersionContext();
  let tools = useProviderTools(instance.data?.id, selectedVersionId);

  return renderWithPagination(tools)(tools => (
    <>
      <Spacer size={10} />

      {tools.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No tools found for this provider.
        </Text>
      )}

      <Flex direction="column" gap={4}>
        {tools.data.items.map(
          (tool: ProviderTool) => {
            let modeBadges = getToolModeBadges(tool);
            let inputSchema = getJsonSchemaObject(tool.inputSchema);
            let outputSchema = getJsonSchemaObject(tool.outputSchema);

            return (
              <AccordionSingle
                key={tool.id}
                title={
                  <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text size="2" weight="strong">
                      {tool.name}
                    </Text>
                    {modeBadges.map(modeBadge => (
                      <Badge key={modeBadge.label} color={modeBadge.color} size="1">
                        {modeBadge.label}
                      </Badge>
                    ))}
                  </Flex>
                }
              >
                <Flex direction="column" gap={16} style={{ padding: '4px 0' }}>
                  {tool.description && (
                    <Text size="2" color="gray600">
                      {tool.description}
                    </Text>
                  )}

                  <Flex gap={32} style={{ flexWrap: 'wrap' }}>
                    {inputSchema && (
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <SchemaViewer schema={inputSchema} title="Input Parameters" />
                      </div>
                    )}
                    {outputSchema && (
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <SchemaViewer schema={outputSchema} title="Output" />
                      </div>
                    )}
                  </Flex>

                  {!inputSchema && !outputSchema && (
                    <Text size="1" color="gray600">
                      No schema defined.
                    </Text>
                  )}
                </Flex>
              </AccordionSingle>
            );
          }
        )}
      </Flex>
    </>
  ));
};
