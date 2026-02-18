import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderTools } from '@metorial/state';
import { AccordionSingle, Badge, Flex, Spacer, Text, theme } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { useProviderVersionContext } from './_layout';

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

let getToolModeBadge = (tool: { name: string; description: string | null }) => {
  let haystack = `${tool.name} ${tool.description ?? ''}`.toLowerCase();

  // Prioritize destructive classification when both write/destructive terms appear.
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

let SchemaViewer = ({
  schema,
  title
}: {
  schema: Record<string, unknown> | null | undefined;
  title: string;
}) => {
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
