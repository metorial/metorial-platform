import { Badge, Flex, Panel, Text, theme, type BadgeStyleProps } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { styled } from 'styled-components';
import { getJsonSchemaObject } from '../../../../lib/jsonSchema';

type SchemaProperty = JSONSchema7;
type PanelWrapperProps = React.ComponentProps<typeof Panel.Wrapper>;
type BadgeColor = BadgeStyleProps['color'];

export type CapabilityMetadataBadge = {
  label: string;
  color: BadgeColor;
};

let MarkdownText = styled.div`
  max-width: 680px;
  color: ${theme.colors.gray600};
  font-size: 14px;
  line-height: 1.45;
`;

let PanelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 28px;
`;

let MetadataStripWrapper = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: ${theme.colors.gray100};
  padding: 10px 12px;
`;

let MetadataValue = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.gray700};
  font-size: 12px;
  font-weight: 500;
`;

let MetadataLabel = styled.span`
  color: ${theme.colors.gray600};
`;

let Section = styled.section`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: ${theme.colors.background};
  overflow: hidden;
`;

let SectionHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let SectionBody = styled.div`
  padding: 10px 12px 12px;
`;

let RowList = styled.div`
  display: flex;
  flex-direction: column;
`;

let DetailRow = styled.div`
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid ${theme.colors.gray200};

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 3px;
  }
`;

let List = styled.ul`
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let ListItem = styled.li`
  color: ${theme.colors.gray700};
  font-size: 14px;
  line-height: 1.4;
  list-style-type: disc;
`;

let PropertyRow = styled.div<{ $nested?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: ${({ $nested }) => ($nested ? '8px 12px' : '8px 2px')};
  border-bottom: 1px solid ${theme.colors.gray200};

  &:last-child {
    border-bottom: none;
  }
`;

let CollapsibleBox = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray300};
  overflow: hidden;
  border-radius: 8px;
  margin-top: 5px;
  width: fit-content;
`;

let CollapsibleToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
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
  background: ${theme.colors.gray100};
`;

let isSchemaObject = (
  value: JSONSchema7Definition | JSONSchema7Definition[] | undefined
): value is JSONSchema7 => !!value && typeof value === 'object' && !Array.isArray(value);

let getSchemaType = (prop: SchemaProperty) => {
  let type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  return typeof type === 'string' ? type : 'any';
};

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

export let getSchemaFieldCount = (schema: ReturnType<typeof getJsonSchemaObject>) =>
  Object.keys(schema?.properties || {}).length;

export let CapabilityMarkdown = ({ children }: { children: string }) => (
  <MarkdownText>
    <ReactMarkdown
      components={{
        p: ({ children }) => <span>{children}</span>,
        h1: ({ children }) => <strong>{children}</strong>,
        h2: ({ children }) => <strong>{children}</strong>,
        h3: ({ children }) => <strong>{children}</strong>,
        h4: ({ children }) => <strong>{children}</strong>,
        h5: ({ children }) => <strong>{children}</strong>,
        h6: ({ children }) => <strong>{children}</strong>
      }}
    >
      {children}
    </ReactMarkdown>
  </MarkdownText>
);

export let CapabilityDetailsPanel = ({
  dialogProps,
  title,
  description,
  children
}: {
  dialogProps: Omit<PanelWrapperProps, 'children' | 'style' | 'width'>;
  title: string;
  description?: string | null;
  children: React.ReactNode;
}) => (
  <Panel.Wrapper
    {...dialogProps}
    width={860}
    style={{
      boxShadow: 'none',
      border: `1px solid ${theme.colors.gray400}`,
      background: theme.colors.background
    }}
  >
    <Panel.Header>
      <Panel.Title>{title}</Panel.Title>
      {description && (
        <Panel.Description>
          <CapabilityMarkdown>{description}</CapabilityMarkdown>
        </Panel.Description>
      )}
    </Panel.Header>

    <Panel.Content>
      <PanelContent>{children}</PanelContent>
    </Panel.Content>
  </Panel.Wrapper>
);

export let MetadataStrip = ({
  label,
  value,
  badges
}: {
  label: string;
  value: React.ReactNode;
  badges: CapabilityMetadataBadge[];
}) => (
  <MetadataStripWrapper>
    <MetadataValue>
      <MetadataLabel>{label}</MetadataLabel>
      <span>{value}</span>
    </MetadataValue>
    {badges.map(badge => (
      <Badge key={`${badge.label}-${badge.color}`} color={badge.color} size="1">
        {badge.label}
      </Badge>
    ))}
  </MetadataStripWrapper>
);

export let DetailSection = ({
  title,
  aside,
  children
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Section>
    <SectionHeader>
      <Text size="2" weight="strong">
        {title}
      </Text>
      {aside}
    </SectionHeader>
    <SectionBody>{children}</SectionBody>
  </Section>
);

export let DetailRows = ({
  rows
}: {
  rows: { label: React.ReactNode; value: React.ReactNode }[];
}) => (
  <RowList>
    {rows.map((row, index) => (
      <DetailRow key={index}>
        <Text size="1" color="gray600" weight="strong">
          {row.label}
        </Text>
        <Text size="2" color="gray700" as="div">
          {row.value}
        </Text>
      </DetailRow>
    ))}
  </RowList>
);

export let DetailList = ({ items }: { items: React.ReactNode[] }) => (
  <List>
    {items.map((item, index) => (
      <ListItem key={index}>{item}</ListItem>
    ))}
  </List>
);

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
      {entries.map(([name, prop]) => {
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
          <PropertyRow key={name} $nested={!!parentId}>
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
          </PropertyRow>
        );
      })}
    </Flex>
  );
};

let SchemaViewer = ({ schema }: { schema: ReturnType<typeof getJsonSchemaObject> }) => {
  let [open, setOpen] = useState<string[]>([]);

  if (!schema?.properties) return null;
  let properties = schema.properties || {};
  let required = schema.required || [];
  let entries = Object.entries(properties);

  if (entries.length === 0) return null;

  return (
    <PropertyList properties={properties} required={required} open={open} setOpen={setOpen} />
  );
};

export let SchemaSection = ({
  title,
  schema
}: {
  title: string;
  schema: ReturnType<typeof getJsonSchemaObject>;
}) => {
  let fieldCount = getSchemaFieldCount(schema);
  if (fieldCount === 0) return null;

  return (
    <DetailSection
      title={title}
      aside={
        <Text size="1" color="gray700">
          {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
        </Text>
      }
    >
      <SchemaViewer schema={schema} />
    </DetailSection>
  );
};
