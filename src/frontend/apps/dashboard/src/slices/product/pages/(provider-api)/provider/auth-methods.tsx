import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderAuthMethods } from '@metorial/state';
import { AccordionSingle, Badge, Flex, Spacer, Text, theme } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { useProviderVersionContext } from './_layout';

type Scope = {
  id: string;
  scope: string;
  name: string;
  description: string | null;
};

type SchemaProperty = {
  type?: string;
  enum?: string[];
  oneOf?: Array<{ type?: string }>;
  anyOf?: Array<{ type?: string }>;
  items?: { type?: string };
  description?: string;
  default?: unknown;
};

type JsonSchema = {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
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
  if (prop.type === 'array' && prop.items?.type) return `${prop.items.type}[]`;
  return prop.type || 'any';
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
    prop.enum || prop.oneOf || prop.anyOf ? 'cyan' : getTypeColor(prop.type || 'any');

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

let ScopeRow = ({ scope, showBorder = true }: { scope: Scope; showBorder?: boolean }) => {
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

let SchemaFields = ({ schema }: { schema: Record<string, unknown> | null | undefined }) => {
  if (!schema) return null;

  let jsonSchema = schema as JsonSchema;
  let properties = jsonSchema.properties || {};
  let required = jsonSchema.required || [];
  let entries = Object.entries(properties);

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

let getScopeDisplay = (scope: Scope) => {
  let primary = scope.description ?? scope.name ?? scope.scope;
  let secondary = primary !== scope.scope ? scope.scope : null;

  return { primary, secondary };
};

export let ProviderAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { providerId } = useParams();
  let { selectedVersionId } = useProviderVersionContext();
  let authMethods = useProviderAuthMethods(instance.data?.instanceId, providerId, {
    providerVersionId: selectedVersionId
  });

  return renderWithPagination(authMethods)(authMethods => {
    let authMethodsToRender = authMethods.data.items as Array<{
      id: string;
      type: 'oauth' | 'token' | 'custom';
      name: string;
      description: string | null;
      inputSchema: Record<string, unknown> | null;
      scopes: Scope[] | null;
    }>;

    return (
      <>
        <Spacer size={10} />

        {authMethodsToRender.length === 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No authentication methods found for this provider.
          </Text>
        )}

        <Flex direction="column" gap={4}>
          {authMethodsToRender.map(
            (method: {
              id: string;
              type: 'oauth' | 'token' | 'custom';
              name: string;
              description: string | null;
              inputSchema: Record<string, unknown> | null;
              scopes: Scope[] | null;
            }) => {
              let hasSchemaFields =
                method.inputSchema &&
                (method.inputSchema as JsonSchema).properties &&
                Object.keys((method.inputSchema as JsonSchema).properties!).length > 0;

              return (
                <AccordionSingle
                  key={method.id}
                  title={
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
                      <Text size="2" weight="strong">
                        {method.name}
                      </Text>
                      {method.type === 'oauth' && (
                        <Badge color="gray" size="1">
                          {method.scopes?.length ?? 0} Scopes
                        </Badge>
                      )}
                    </Flex>
                  }
                >
                  <Flex direction="column" gap={12} style={{ padding: '4px 0' }}>
                    {method.description && (
                      <Text
                        size="1"
                        color="gray600"
                        style={{ display: 'block', marginTop: 4 }}
                      >
                        {method.description}
                      </Text>
                    )}

                    {method.type === 'oauth' && method.scopes && method.scopes.length > 0 && (
                      <div>
                        <Text
                          size="2"
                          weight="strong"
                          style={{ display: 'block', marginBottom: 16 }}
                        >
                          Requested Scopes
                        </Text>
                        <Flex direction="column">
                          {method.scopes.map((scope: Scope, index: number) => (
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
                      <>
                        <Text
                          size="2"
                          weight="strong"
                          style={{ display: 'block', marginBottom: 4 }}
                        >
                          Required Fields
                        </Text>
                        <SchemaFields schema={method.inputSchema} />
                      </>
                    )}
                  </Flex>
                </AccordionSingle>
              );
            }
          )}
        </Flex>
      </>
    );
  });
};
