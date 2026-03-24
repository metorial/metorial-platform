import { DashboardInstanceProvidersToolsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderTools } from '@metorial/state';
import { Badge, Button, Dialog, Flex, Text, showModal, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { RiArrowDownSLine } from '@remixicon/react';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { styled } from 'styled-components';
import { getJsonSchemaObject } from '../../lib/jsonSchema';
import { useProviderVersionContext } from './_layout';

type SchemaProperty = JSONSchema7;
type ProviderTool = DashboardInstanceProvidersToolsListOutput['items'][number];
type ToolModeBadge = { label: string; color: 'red' | 'green' };

let isSchemaObject = (
  value: JSONSchema7Definition | JSONSchema7Definition[] | undefined
): value is JSONSchema7 => !!value && typeof value === 'object' && !Array.isArray(value);

let getSchemaType = (prop: SchemaProperty) => {
  let type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  return typeof type === 'string' ? type : 'any';
};

let CollapsibleBox = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray300};
  overflow: hidden;
  border-radius: 8px;
  margin-top: 4px;
  width: fit-content;
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

let CollapsibleBody = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${theme.colors.gray300};
`;

let InfoCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};
  padding: 10px 12px;
`;

let InfoList = styled.ul`
  margin: 6px 0px 0px;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let InfoListItem = styled.li`
  color: ${theme.colors.gray700};
  font-size: 16px;
  line-height: 1.4;
`;

let SchemaColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 320px;
`;

let SchemaHeading = styled.div`
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  color: ${theme.colors.gray900};
`;

let SchemaCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: #fff;
  min-height: 100%;
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(16, 24, 40, 0.04),
    0 1px 3px rgba(16, 24, 40, 0.08);
`;

let SchemaCardHeader = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let SchemaCardBody = styled.div`
  padding: 8px 12px 12px;
  min-height: 100%;
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
  return variants.filter(
    (v): v is SchemaProperty => typeof v === 'object' && v?.type !== 'null'
  );
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
    if (isSchemaObject(prop.items))
      return `Array of ${formatType(getSchemaType(prop.items))}s`;
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

let ScopeList = styled.ul`
  margin: 6px 0px 0px;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let getSchemaFieldCount = (schema: ReturnType<typeof getJsonSchemaObject>) =>
  Object.keys(schema?.properties || {}).length;

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
              padding: parentId ? '8px 12px' : '8px 2px',
              borderBottom:
                index < entries.length - 1 ? `1px solid ${theme.colors.gray200}` : undefined
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
              <Text size="1" color="gray600" style={{ lineHeight: 1.35 }}>
                {prop.description}
              </Text>
            )}
            {prop.enum && (
              <Text size="1" color="gray600">
                Values: {prop.enum.join(', ')}
              </Text>
            )}
            {nestedProps && collapsibleLabel && (
              <CollapsibleBox style={{ width: isOpen ? '100%' : 'fit-content' }}>
                <CollapsibleToggle
                  onClick={() => setOpen(o => (isOpen ? o.filter(x => x !== id) : [...o, id]))}
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
                {isOpen && (
                  <CollapsibleBody>
                    <PropertyList
                      properties={nestedProps}
                      required={nestedRequired}
                      open={open}
                      setOpen={setOpen}
                      parentId={id}
                    />
                  </CollapsibleBody>
                )}
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
  title?: string;
}) => {
  let [open, setOpen] = useState<string[]>([]);

  if (!schema?.properties) return null;
  let properties = schema.properties || {};
  let required = schema.required || [];
  let entries = Object.entries(properties);

  if (entries.length === 0) return null;

  return (
    <div>
      {title && (
        <Text size="2" weight="strong" style={{ display: 'block', marginBottom: 4 }}>
          {title}
        </Text>
      )}
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

  let onViewDetails = (tool: ProviderTool) => {
    let modeBadges = getToolModeBadges(tool);
    let inputSchema = getJsonSchemaObject(tool.inputSchema);
    let outputSchema = getJsonSchemaObject(tool.outputSchema);

    showModal(({ dialogProps }) => (
      <Dialog.Wrapper {...dialogProps} width={840}>
        <Dialog.Title>{tool.name}</Dialog.Title>
        {tool.description && (
          <Dialog.Description>
            <ReactMarkdown
              components={{
                h1: ({ children }) => <strong>{children}</strong>,
                h2: ({ children }) => <strong>{children}</strong>,
                h3: ({ children }) => <strong>{children}</strong>,
                h4: ({ children }) => <strong>{children}</strong>,
                h5: ({ children }) => <strong>{children}</strong>,
                h6: ({ children }) => <strong>{children}</strong>
              }}
            >
              {tool.description}
            </ReactMarkdown>
          </Dialog.Description>
        )}

        <Flex direction="column" gap={12} style={{ paddingBottom: 28 }}>
          <InfoCard>
            <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Text size="1" color="gray700">
                Key: {tool.key}
              </Text>
              {modeBadges.map(modeBadge => (
                <Badge key={modeBadge.label} color={modeBadge.color} size="1">
                  {modeBadge.label}
                </Badge>
              ))}
            </Flex>
          </InfoCard>

          {tool.meta && (
            <InfoCard>
              <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Text size="2" weight="strong">
                  Scopes
                </Text>
                <Badge color={tool.meta.enabled ? 'green' : 'red'} size="1">
                  {tool.meta.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Flex>
              <ScopeList>
                {tool.meta.requiredScopes.map(scope => (
                  <InfoListItem key={scope}>
                    <Text
                      size="1"
                      color={tool.meta!.missingScopes.includes(scope) ? 'red' : 'gray600'}
                    >
                      {scope}
                      {tool.meta!.missingScopes.includes(scope) && ' (missing)'}
                    </Text>
                  </InfoListItem>
                ))}
              </ScopeList>
            </InfoCard>
          )}

          {(tool.instructions?.length ?? 0) > 0 && (
            <InfoCard>
              <Text size="2" weight="strong">
                Instructions
              </Text>
              <InfoList>
                {tool.instructions?.map((instruction, i) => (
                  <InfoListItem key={i}>{instruction}</InfoListItem>
                ))}
              </InfoList>
            </InfoCard>
          )}

          {(tool.constraints?.length ?? 0) > 0 && (
            <InfoCard>
              <Text size="2" weight="strong">
                Constraints
              </Text>
              <InfoList>
                {tool.constraints?.map((constraint, i) => (
                  <InfoListItem key={i}>{constraint}</InfoListItem>
                ))}
              </InfoList>
            </InfoCard>
          )}

          {(getSchemaFieldCount(inputSchema) > 0 || getSchemaFieldCount(outputSchema) > 0) && (
            <Flex gap={18} style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
              {getSchemaFieldCount(inputSchema) > 0 && (
                <SchemaColumn>
                  <SchemaHeading>Input</SchemaHeading>
                  <SchemaCard>
                    <SchemaCardHeader>
                      <Text size="1" color="gray700">
                        {getSchemaFieldCount(inputSchema)} Fields
                      </Text>
                    </SchemaCardHeader>
                    <SchemaCardBody>
                      <SchemaViewer schema={inputSchema} />
                    </SchemaCardBody>
                  </SchemaCard>
                </SchemaColumn>
              )}
              {getSchemaFieldCount(outputSchema) > 0 && (
                <SchemaColumn>
                  <SchemaHeading>Output</SchemaHeading>
                  <SchemaCard>
                    <SchemaCardHeader>
                      <Text size="1" color="gray700">
                        {getSchemaFieldCount(outputSchema)} Fields
                      </Text>
                    </SchemaCardHeader>
                    <SchemaCardBody>
                      <SchemaViewer schema={outputSchema} />
                    </SchemaCardBody>
                  </SchemaCard>
                </SchemaColumn>
              )}
            </Flex>
          )}
        </Flex>
      </Dialog.Wrapper>
    ));
  };

  let toolsContent = renderWithPagination(tools)(tools => (
    <>
      <Table
        headers={['Name', 'Type', '']}
        data={tools.data.items.map(tool => {
          let modeBadges = getToolModeBadges(tool);
          let description =
            tool.description && tool.description.length > 110
              ? `${tool.description.slice(0, 110)}...`
              : (tool.description ?? '');

          return {
            data: [
              <Flex direction="column" gap={2}>
                <Text size="2" weight="strong">
                  {tool.name}
                </Text>
                <Text
                  size="2"
                  color="gray600"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {description}
                </Text>
              </Flex>,
              <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {modeBadges.length > 0 ? (
                  modeBadges.map(modeBadge => (
                    <Badge key={modeBadge.label} color={modeBadge.color} size="1">
                      {modeBadge.label}
                    </Badge>
                  ))
                ) : (
                  <Badge color="gray" size="1">
                    Default
                  </Badge>
                )}
                {tool.meta && (
                  <Badge color={tool.meta.enabled ? 'green' : 'red'} size="1">
                    {tool.meta.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                )}
              </Flex>,
              <Button size="1" variant="outline" onClick={() => onViewDetails(tool)}>
                View Details
              </Button>
            ]
          };
        })}
      />

      {tools.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No tools found for this provider.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance })(() => toolsContent);
};
