import {
  DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderAuthMethods } from '@metorial/state';
import { Badge, Button, Dialog, Flex, Text, showModal, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import {
  getJsonSchemaObject,
  hasJsonSchemaProperties,
  type JsonSchemaObject
} from '../../../lib/jsonSchema';
import { useProviderVersionContext } from './_layout';

type ProviderAuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];
type ProviderAuthScope = NonNullable<ProviderAuthMethod['scopes']>[number];
type SchemaProperty = NonNullable<JsonSchemaObject['properties']>[string] & JsonSchemaObject;

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
  if (prop.enum) return 'enum';
  if (prop.oneOf || prop.anyOf) return 'union';
  if (getSchemaType(prop) === 'array' && isSchemaProperty(prop.items)) {
    return `${getSchemaType(prop.items)}[]`;
  }
  return getSchemaType(prop);
};

let getAuthTypeBadgeLabel = (type: 'oauth' | 'token' | 'custom') => {
  if (type === 'oauth') return 'OAuth';
  return type.charAt(0).toUpperCase() + type.slice(1);
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
      <Flex gap={6} style={{ alignItems: 'center' }}>
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
  let { primary, secondary } = getScopeDisplay(scope);

  return (
    <Flex
      direction="column"
      gap={2}
      style={{
        padding: '6px 0',
        borderBottom: showBorder ? `1px solid ${theme.colors.gray200}` : undefined
      }}
    >
      <Flex gap={6} style={{ alignItems: 'center' }}>
        <Text size="2" weight="strong">
          {primary}
        </Text>
      </Flex>
      {secondary && (
        <Text size="1" color="gray600">
          {secondary}
        </Text>
      )}
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
      {entries.map(([name, prop], index) => {
        return (
          <PropertyRow
            key={name}
            name={name}
            prop={prop}
            isRequired={required.includes(name)}
            showBorder={index < entries.length - 1}
          />
        );
      })}
    </Flex>
  );
};

let getScopeDisplay = (scope: ProviderAuthScope) => {
  let primary = scope.description ?? scope.name ?? scope.scope;
  let secondary = primary !== scope.scope ? scope.scope : null;

  return { primary, secondary };
};

export let ProviderAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId } = useProviderVersionContext();
  let authMethods = useProviderAuthMethods(instance.data?.id, selectedVersionId);

  let onViewDetails = (method: ProviderAuthMethod) => {
    let inputSchema = getJsonSchemaObject(method.inputSchema);
    let hasSchemaFields = hasJsonSchemaProperties(method.inputSchema);

    showModal(({ dialogProps }) => (
      <Dialog.Wrapper {...dialogProps} width={760}>
        <Dialog.Title>{method.name}</Dialog.Title>
        <Dialog.Description>{method.description ?? 'No description.'}</Dialog.Description>

        <Flex direction="column" gap={12} style={{ paddingTop: 8, paddingBottom: 14 }}>
          <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge
              color={
                method.type === 'oauth'
                  ? 'blue'
                  : method.type === 'token'
                    ? 'green'
                    : 'gray'
              }
              size="1"
            >
              {getAuthTypeBadgeLabel(method.type)}
            </Badge>
            {method.type === 'oauth' && (
              <Badge color="gray" size="1">
                {method.scopes?.length ?? 0} Scopes
              </Badge>
            )}
          </Flex>

          {method.type === 'oauth' && method.scopes && method.scopes.length > 0 && (
            <div>
              <Text size="2" weight="strong" style={{ display: 'block', marginBottom: 8 }}>
                Requested Scopes
              </Text>
              <Flex direction="column">
                {method.scopes.map((scope: ProviderAuthScope, index: number) => (
                  <ScopeRow
                    key={scope.id}
                    scope={scope}
                    showBorder={index < method.scopes!.length - 1}
                  />
                ))}
              </Flex>
            </div>
          )}

          {hasSchemaFields && (
            <div>
              <Text size="2" weight="strong" style={{ display: 'block', marginBottom: 8 }}>
                Input Fields
              </Text>
              <SchemaFields schema={inputSchema} />
            </div>
          )}
        </Flex>
      </Dialog.Wrapper>
    ));
  };

  return renderWithLoader({ instance })(() =>
    renderWithPagination(authMethods)(authMethods => (
      <>
        <Table
          headers={['Name', 'Type', '']}
          data={authMethods.data.items.map(method => {
            let description =
              method.description && method.description.length > 110
                ? `${method.description.slice(0, 110)}...`
                : (method.description ?? '');

            return {
              data: [
                <Flex direction="column" gap={2}>
                  <Text size="2" weight="strong">
                    {method.name}
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
                  <Badge
                    color={
                      method.type === 'oauth'
                        ? 'blue'
                        : method.type === 'token'
                          ? 'green'
                          : 'gray'
                    }
                    size="1"
                  >
                    {getAuthTypeBadgeLabel(method.type)}
                  </Badge>
                </Flex>,
                <Flex style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button size="1" variant="outline" onClick={() => onViewDetails(method)}>
                    View Details
                  </Button>
                </Flex>
              ]
            };
          })}
        />

        {authMethods.data.items.length === 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No authentication methods found for this provider.
          </Text>
        )}
      </>
    ))
  );
};
