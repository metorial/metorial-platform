import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderTools } from '@metorial/state';
import { AccordionSingle, Badge, Flex, Spacer, Text, theme } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { useProviderVersionContext } from './_layout';

type SchemaProperty = {
  type?: string;
  enum?: string[];
  oneOf?: Array<SchemaProperty>;
  anyOf?: Array<SchemaProperty>;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  description?: string;
  default?: unknown;
};

type JsonSchema = {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
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

let getTypeLabel = (prop: SchemaProperty): string => {
  if (prop.enum) return 'Enum';
  if (prop.oneOf || prop.anyOf) {
    let variants = (prop.oneOf || prop.anyOf)!;
    let labels = variants.map(v => formatType(v.type));
    if (labels.length <= 3) return labels.join(' | ');
    return 'Union';
  }
  if (prop.type === 'array') {
    if (prop.items?.properties) return 'Array of Objects';
    if (prop.items?.type) return `Array of ${formatType(prop.items.type)}s`;
    return 'Array';
  }
  return formatType(prop.type);
};

let getCollapsibleLabel = (prop: SchemaProperty): string => {
  if (prop.enum) return 'Possible values';
  if (prop.type === 'array') {
    let itemType = prop.items?.type;
    if (itemType) return `Array of ${itemType}s`;
    if (prop.items?.properties) return 'Array of objects';
    return 'Array items';
  }
  if (prop.type === 'object') return 'Object properties';
  if (prop.oneOf || prop.anyOf) return 'Union types';
  return 'Properties';
};

let getToolModeBadge = (tool: { name: string; description: string | null }) => {
  let haystack = `${tool.name} ${tool.description ?? ''}`.toLowerCase();

  if (/(delete|destroy|remove|revoke|wipe|purge|reset|terminate)\b/.test(haystack)) {
    return { label: 'Destructive', color: 'red' as const };
  }

  if (
    /(create|update|edit|set|write|insert|add|submit|send|upload|post|put|patch|enable|disable)\b/.test(
      haystack
    )
  ) {
    return { label: 'Write', color: 'orange' as const };
  }

  return { label: 'Read-only', color: 'green' as const };
};

let PropertyList = ({
  properties,
  required = [],
  open,
  setOpen,
  parentId
}: {
  properties: Record<string, SchemaProperty>;
  required?: string[];
  open: string[];
  setOpen: React.Dispatch<React.SetStateAction<string[]>>;
  parentId?: string;
}) => {
  let entries = Object.entries(properties);
  if (entries.length === 0) return null;

  return (
    <Flex direction="column">
      {entries.map(([name, prop], index) => {
        let id = `${parentId ?? ''}:${name}`;
        let isOpen = open.includes(id);
        let typeLabel = getTypeLabel(prop);
        let typeColor =
          prop.enum || prop.oneOf || prop.anyOf ? 'cyan' : getTypeColor(prop.type || 'any');

        let nestedProps: Record<string, SchemaProperty> | undefined;
        let nestedRequired: string[] | undefined;
        let collapsibleLabel: string | undefined;

        if (prop.properties && Object.keys(prop.properties).length > 0) {
          nestedProps = prop.properties;
          nestedRequired = prop.required;
          collapsibleLabel = getCollapsibleLabel(prop);
        } else if (prop.type === 'array' && prop.items?.properties && Object.keys(prop.items.properties).length > 0) {
          nestedProps = prop.items.properties;
          nestedRequired = prop.items.required;
          collapsibleLabel = getCollapsibleLabel(prop);
        } else if (prop.oneOf || prop.anyOf) {
          let variant = (prop.oneOf || prop.anyOf)!.find(
            v => v.properties && Object.keys(v.properties).length > 0
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
            <Flex gap={6} style={{ alignItems: 'center' }}>
              <Text size="2" weight="strong">
                {name}
              </Text>
              <Badge color={typeColor} size="1">
                {typeLabel}
              </Badge>
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
  schema: Record<string, unknown> | null | undefined;
  title: string;
}) => {
  let [open, setOpen] = useState<string[]>([]);

  if (!schema) return null;

  let jsonSchema = schema as JsonSchema;
  let properties = jsonSchema.properties || {};
  let required = jsonSchema.required || [];
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
  let { providerId } = useParams();
  let { selectedVersionId } = useProviderVersionContext();
  let tools = useProviderTools(instance.data?.id, providerId, {
    providerVersionId: selectedVersionId
  });

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
          (tool: {
            id: string;
            name: string;
            description: string | null;
            inputSchema: Record<string, unknown> | null;
            outputSchema: Record<string, unknown> | null;
          }) => {
            let modeBadge = getToolModeBadge(tool);

            return (
              <AccordionSingle
                key={tool.id}
                title={
                  <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text size="2" weight="strong">
                      {tool.name}
                    </Text>
                    <Badge color={modeBadge.color} size="1">
                      {modeBadge.label}
                    </Badge>
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
                    {tool.inputSchema && (
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <SchemaViewer schema={tool.inputSchema} title="Input Parameters" />
                      </div>
                    )}
                    {tool.outputSchema && (
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <SchemaViewer schema={tool.outputSchema} title="Output" />
                      </div>
                    )}
                  </Flex>

                  {!tool.inputSchema && !tool.outputSchema && (
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
