import { DashboardInstanceProvidersAuthMethodsListOutput } from '@metorial/dashboard-sdk';
import { Badge, Dialog, Flex, Text, showModal, theme } from '@metorial/ui';
import { styled } from 'styled-components';
import {
  getJsonSchemaObject,
  hasJsonSchemaProperties,
  type JsonSchemaObject
} from '../../lib/jsonSchema';

export type ProviderAuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];
type ProviderAuthScope = NonNullable<ProviderAuthMethod['scopes']>[number];
type SchemaProperty = NonNullable<JsonSchemaObject['properties']>[string] & JsonSchemaObject;

let SectionCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};
  padding: 10px 12px;
`;

let SchemaColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 280px;
`;

let SchemaHeading = styled.div`
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
  color: ${theme.colors.gray900};
`;

let SchemaCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: #fff;
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
`;

let isSchemaProperty = (value: unknown): value is SchemaProperty =>
  !!value && typeof value === 'object' && !Array.isArray(value);

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

let getTypeLabel = (prop: SchemaProperty): string => {
  if (prop.enum) return 'Enum';
  if (prop.oneOf || prop.anyOf) return 'Union';
  if (getSchemaType(prop) === 'array' && isSchemaProperty(prop.items)) {
    return `${getSchemaType(prop.items)}[]`;
  }
  return getSchemaType(prop);
};

let PropertyRow = ({
  name,
  prop,
  isRequired,
  showBorder = true
}: {
  name: string;
  prop: SchemaProperty;
  isRequired: boolean;
  showBorder?: boolean;
}) => {
  let typeLabel = getTypeLabel(prop);
  let typeColor =
    prop.enum || prop.oneOf || prop.anyOf ? 'cyan' : getTypeColor(getSchemaType(prop));

  return (
    <Flex
      direction="column"
      gap={2}
      style={{
        padding: '6px 0',
        borderBottom: showBorder ? `1px solid ${theme.colors.gray200}` : undefined
      }}
    >
      <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Text size="2" weight="strong">
          {name}
        </Text>
        <Badge color={typeColor} size="1">
          {typeLabel}
        </Badge>
        {isRequired ? (
          <Badge color="red" size="1">
            Required
          </Badge>
        ) : (
          <Badge color="gray" size="1">
            Optional
          </Badge>
        )}
      </Flex>
      {prop.description ? (
        <Text size="1" color="gray600">
          {prop.description}
        </Text>
      ) : null}
      {prop.enum ? (
        <Text size="1" color="gray600">
          Values: {prop.enum.join(', ')}
        </Text>
      ) : null}
    </Flex>
  );
};

let ScopeRow = ({
  scope,
  showBorder = true
}: {
  scope: ProviderAuthScope;
  showBorder?: boolean;
}) => {
  let primary = scope.description ?? scope.name ?? scope.scope;
  let secondary = primary !== scope.scope ? scope.scope : null;

  return (
    <Flex
      direction="column"
      gap={2}
      style={{
        padding: '6px 0',
        borderBottom: showBorder ? `1px solid ${theme.colors.gray200}` : undefined
      }}
    >
      <Text size="2" weight="strong">
        {primary}
      </Text>
      {secondary ? (
        <Text size="1" color="gray600">
          {secondary}
        </Text>
      ) : null}
    </Flex>
  );
};

let SchemaFields = ({ schema }: { schema: JsonSchemaObject | null | undefined }) => {
  if (!schema) return null;

  let properties = schema.properties || {};
  let required = schema.required || [];
  let entries = Object.entries(properties).flatMap(([name, prop]) =>
    isSchemaProperty(prop) ? ([[name, prop]] as const) : []
  );

  if (entries.length === 0) return null;

  return (
    <Flex direction="column">
      {entries.map(([name, prop], index) => (
        <PropertyRow
          key={name}
          name={name}
          prop={prop}
          isRequired={required.includes(name)}
          showBorder={index < entries.length - 1}
        />
      ))}
    </Flex>
  );
};

export let getProviderAuthMethodTypeLabel = (
  type: ProviderAuthMethod['type']
): string => {
  if (type === 'oauth') return 'OAuth';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export let getProviderAuthMethodTypeColor = (
  type: ProviderAuthMethod['type']
): 'blue' | 'green' | 'gray' => {
  if (type === 'oauth') return 'blue';
  if (type === 'token') return 'green';
  return 'gray';
};

export let getProviderAuthMethodSchemaFieldCount = (
  schemaValue: ProviderAuthMethod['inputSchema'] | ProviderAuthMethod['outputSchema']
): number => {
  let schema = getJsonSchemaObject(schemaValue);
  return Object.keys(schema?.properties || {}).length;
};

export let hasProviderAuthMethodSchemaFields = (
  schemaValue: ProviderAuthMethod['inputSchema'] | ProviderAuthMethod['outputSchema']
): boolean => hasJsonSchemaProperties(schemaValue);

export let showProviderAuthMethodDetailsModal = (method: ProviderAuthMethod) => {
  let inputSchema = getJsonSchemaObject(method.inputSchema);
  let outputSchema = getJsonSchemaObject(method.outputSchema);
  let hasInputFields = hasProviderAuthMethodSchemaFields(method.inputSchema);
  let hasOutputFields = hasProviderAuthMethodSchemaFields(method.outputSchema);
  let scopes = method.scopes ?? [];

  showModal(({ dialogProps }) => (
    <Dialog.Wrapper {...dialogProps} width={840}>
      <Dialog.Title>{method.name}</Dialog.Title>
      <Dialog.Description>{method.description ?? 'No description.'}</Dialog.Description>

      <Flex direction="column" gap={12} style={{ paddingTop: 8, paddingBottom: 20 }}>
        <SectionCard>
          <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge color={getProviderAuthMethodTypeColor(method.type)} size="1">
              {getProviderAuthMethodTypeLabel(method.type)}
            </Badge>
            {method.type === 'oauth' && scopes.length > 0 ? (
              <Badge color="gray" size="1">
                {scopes.length} Scopes
              </Badge>
            ) : null}
            {hasInputFields ? (
              <Badge color="cyan" size="1">
                {getProviderAuthMethodSchemaFieldCount(method.inputSchema)} Input Fields
              </Badge>
            ) : null}
            {hasOutputFields ? (
              <Badge color="purple" size="1">
                {getProviderAuthMethodSchemaFieldCount(method.outputSchema)} Output Fields
              </Badge>
            ) : null}
          </Flex>
        </SectionCard>

        {method.type === 'oauth' && scopes.length > 0 ? (
          <SectionCard>
            <Text size="2" weight="strong">
              Requested Scopes
            </Text>
            <Flex direction="column" style={{ marginTop: 8 }}>
              {scopes.map((scope, index) => (
                <ScopeRow
                  key={scope.id}
                  scope={scope}
                  showBorder={index < scopes.length - 1}
                />
              ))}
            </Flex>
          </SectionCard>
        ) : null}

        <Flex gap={18} style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
          {hasInputFields ? (
            <SchemaColumn>
              <SchemaHeading>Input</SchemaHeading>
              <SchemaCard>
                <SchemaCardHeader>
                  <Text size="1" color="gray700">
                    {getProviderAuthMethodSchemaFieldCount(method.inputSchema)} Fields
                  </Text>
                </SchemaCardHeader>
                <SchemaCardBody>
                  <SchemaFields schema={inputSchema} />
                </SchemaCardBody>
              </SchemaCard>
            </SchemaColumn>
          ) : null}

          {hasOutputFields ? (
            <SchemaColumn>
              <SchemaHeading>Output</SchemaHeading>
              <SchemaCard>
                <SchemaCardHeader>
                  <Text size="1" color="gray700">
                    {getProviderAuthMethodSchemaFieldCount(method.outputSchema)} Fields
                  </Text>
                </SchemaCardHeader>
                <SchemaCardBody>
                  <SchemaFields schema={outputSchema} />
                </SchemaCardBody>
              </SchemaCard>
            </SchemaColumn>
          ) : null}
        </Flex>

        {!hasInputFields && !hasOutputFields && scopes.length === 0 ? (
          <Text size="1" color="gray600">
            No schema or scopes defined.
          </Text>
        ) : null}
      </Flex>
    </Dialog.Wrapper>
  ));
};
