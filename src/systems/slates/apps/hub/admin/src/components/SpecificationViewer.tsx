import {
  Accordion,
  AccordionSingle,
  Badge,
  Datalist,
  Flex,
  Group,
  Tabs,
  Text
} from '@metorial/ui';
import { useState } from 'react';
import { useDiscoverySpecification } from '../state/discoveries.js';
import { MonoCode } from './styled';

type SlateDiscoverySpecification = NonNullable<
  ReturnType<typeof useDiscoverySpecification>['data']
>;

type SchemaProperty = {
  type?: string;
  enum?: string[];
  oneOf?: Array<{ type?: string }>;
  anyOf?: Array<{ type?: string }>;
  items?: { type?: string };
  description?: string;
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
  if (prop.enum) return 'Enum';
  if (prop.oneOf || prop.anyOf) return 'Union';
  if (prop.type === 'array' && prop.items?.type) return `${prop.items.type}[]`;
  return prop.type || 'any';
};

let PropertyItem = ({
  name,
  prop,
  isRequired
}: {
  name: string;
  prop: SchemaProperty;
  isRequired: boolean;
}) => {
  let typeLabel = getTypeLabel(prop);
  let typeColor =
    prop.enum || prop.oneOf || prop.anyOf ? 'cyan' : getTypeColor(prop.type || 'any');

  return (
    <Flex
      direction="column"
      gap={4}
      style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}
    >
      <Flex align="center" gap={8}>
        <Text size="2" weight="strong">
          {name}
        </Text>
        <Badge color={typeColor} size="1">
          {typeLabel}
        </Badge>
        {!isRequired && (
          <Badge color="gray" size="1">
            Optional
          </Badge>
        )}
      </Flex>
      {prop.description && (
        <Text size="1" color="gray600">
          {prop.description}
        </Text>
      )}
      {prop.enum && (
        <AccordionSingle title="Possible values" defaultOpen={false}>
          <Flex direction="column" gap={4} style={{ paddingLeft: 8 }}>
            {prop.enum.map((val: string) => (
              <Text key={val} size="2">
                {val}
              </Text>
            ))}
          </Flex>
        </AccordionSingle>
      )}
      {(prop.oneOf || prop.anyOf) && (
        <AccordionSingle title="Union types" defaultOpen={false}>
          <Flex direction="column" gap={4} style={{ paddingLeft: 8 }}>
            {(prop.oneOf || prop.anyOf)!.map((t, i) => (
              <Text key={i} size="2">
                {t.type || JSON.stringify(t)}
              </Text>
            ))}
          </Flex>
        </AccordionSingle>
      )}
    </Flex>
  );
};

let SchemaViewer = ({
  schema,
  title
}: {
  schema: JsonSchema | null | undefined;
  title: string;
}) => {
  if (!schema) return null;

  let properties = schema.properties || {};
  let required = schema.required || [];

  let propertyEntries = Object.entries(properties);

  if (propertyEntries.length === 0) return null;

  return (
    <Flex direction="column" gap={8}>
      <Text size="3" weight="strong">
        {title}
      </Text>
      <Flex direction="column">
        {propertyEntries.map(([name, prop]) => (
          <PropertyItem
            key={name}
            name={name}
            prop={prop}
            isRequired={required.includes(name)}
          />
        ))}
      </Flex>
    </Flex>
  );
};

type TabType = 'overview' | 'tools' | 'triggers' | 'auth';

type ToolCallStats = {
  total: number;
  succeeded: number;
  failed: number;
  byTool?: Record<string, { total: number; succeeded: number; failed: number }>;
};

type SpecificationViewerProps = {
  specification: SlateDiscoverySpecification;
  toolCallStats?: ToolCallStats | null;
};

export let SpecificationViewer = ({
  specification,
  toolCallStats
}: SpecificationViewerProps) => {
  let [activeTab, setActiveTab] = useState<TabType>('overview');

  let toolsCount = specification?.tools?.length ?? 0;
  let triggersCount = specification?.triggers?.length ?? 0;
  let authCount = specification?.authMethods?.length ?? 0;

  let tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tools', label: `Tools (${toolsCount})` },
    { id: 'triggers', label: `Triggers (${triggersCount})` },
    { id: 'auth', label: `Auth Methods (${authCount})` }
  ];

  return (
    <Group.Wrapper>
      <Tabs
        current={activeTab}
        tabs={tabs}
        action={id => setActiveTab(id as TabType)}
        tabIndicator
        padding={{ left: 20, right: 20 }}
        margin={{ bottom: 0 }}
      />

      <Group.Content>
        {activeTab === 'overview' && (
          <Flex direction="column" gap={24}>
            <Datalist
              items={[
                { label: 'Provider Name', value: specification.name || '-' },
                {
                  label: 'Provider Key',
                  value: <MonoCode>{specification.key || '-'}</MonoCode>
                },
                {
                  label: 'Protocol Version',
                  value: <MonoCode>{specification.protocolVersion || '-'}</MonoCode>
                }
              ]}
            />

            {toolCallStats && toolCallStats.total > 0 && (
              <Flex direction="column" gap={12}>
                <Text size="3" weight="strong">
                  Usage Statistics
                </Text>
                <Flex gap={24}>
                  <Flex
                    direction="column"
                    gap={4}
                    style={{
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderRadius: 8,
                      minWidth: 100
                    }}
                  >
                    <Text size="1" color="gray600">
                      Total Calls
                    </Text>
                    <Text size="5" weight="strong">
                      {toolCallStats.total.toString()}
                    </Text>
                  </Flex>
                  <Flex
                    direction="column"
                    gap={4}
                    style={{
                      padding: '12px 16px',
                      background: '#f0fdf4',
                      borderRadius: 8,
                      minWidth: 100
                    }}
                  >
                    <Text size="1" color="gray600">
                      Succeeded
                    </Text>
                    <Text size="5" weight="strong" color="green300">
                      {toolCallStats.succeeded.toString()}
                    </Text>
                  </Flex>
                  {toolCallStats.failed > 0 && (
                    <Flex
                      direction="column"
                      gap={4}
                      style={{
                        padding: '12px 16px',
                        background: '#fef2f2',
                        borderRadius: 8,
                        minWidth: 100
                      }}
                    >
                      <Text size="1" color="gray600">
                        Failed
                      </Text>
                      <Text size="5" weight="strong" color="red300">
                        {toolCallStats.failed.toString()}
                      </Text>
                    </Flex>
                  )}
                </Flex>
              </Flex>
            )}
          </Flex>
        )}

        {activeTab === 'tools' && (
          <Flex direction="column" gap={8}>
            {toolsCount === 0 ? (
              <Text size="2" color="gray600">
                No tools discovered.
              </Text>
            ) : (
              <Accordion
                type="multiple"
                items={specification.tools!.map(tool => {
                  let toolStats = toolCallStats?.byTool?.[tool.key];
                  return {
                    id: tool.key,
                    title: (
                      <Flex align="center" gap={8}>
                        <Text size="2" weight="strong">
                          {tool.name}
                        </Text>
                        <MonoCode>{tool.key}</MonoCode>
                        {toolStats && toolStats.total > 0 && (
                          <Badge color="gray" size="1">
                            {toolStats.total.toString()} calls
                          </Badge>
                        )}
                      </Flex>
                    ),
                    content: (
                      <Flex direction="column" gap={16}>
                        {tool.description && (
                          <Text size="2" color="gray600">
                            {tool.description}
                          </Text>
                        )}
                        {toolStats && toolStats.total > 0 && (
                          <Flex gap={16}>
                            <Badge color="green" size="2">
                              {toolStats.succeeded} succeeded
                            </Badge>
                            {toolStats.failed > 0 && (
                              <Badge color="red" size="2">
                                {toolStats.failed} failed
                              </Badge>
                            )}
                          </Flex>
                        )}
                        <Flex gap={32}>
                          <div style={{ flex: 1 }}>
                            <SchemaViewer schema={tool.inputSchema} title="Input Parameters" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <SchemaViewer schema={tool.outputSchema} title="Output" />
                          </div>
                        </Flex>
                      </Flex>
                    )
                  };
                })}
              />
            )}
          </Flex>
        )}

        {activeTab === 'triggers' && (
          <Flex direction="column" gap={8}>
            {triggersCount === 0 ? (
              <Text size="2" color="gray600">
                No triggers discovered.
              </Text>
            ) : (
              <Accordion
                type="multiple"
                items={specification.triggers!.map(trigger => ({
                  id: trigger.key,
                  title: (
                    <Flex align="center" gap={8}>
                      <Text size="2" weight="strong">
                        {trigger.name}
                      </Text>
                      <MonoCode>{trigger.key}</MonoCode>
                    </Flex>
                  ),
                  content: (
                    <Flex direction="column" gap={16}>
                      {trigger.description && (
                        <Text size="2" color="gray600">
                          {trigger.description}
                        </Text>
                      )}
                      <Flex gap={32}>
                        <div style={{ flex: 1 }}>
                          <SchemaViewer schema={trigger.inputSchema} title="Input" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <SchemaViewer schema={trigger.outputSchema} title="Output" />
                        </div>
                      </Flex>
                    </Flex>
                  )
                }))}
              />
            )}
          </Flex>
        )}

        {activeTab === 'auth' && (
          <Flex direction="column" gap={8}>
            {authCount === 0 ? (
              <Text size="2" color="gray600">
                No auth methods discovered.
              </Text>
            ) : (
              <Accordion
                type="multiple"
                items={specification.authMethods!.map((method, index) => {
                  let hasInputSchema =
                    method.inputSchema?.properties &&
                    Object.keys(method.inputSchema.properties).length > 0;
                  let hasOutputSchema =
                    method.outputSchema?.properties &&
                    Object.keys(method.outputSchema.properties).length > 0;
                  let hasBothSchemas = hasInputSchema && hasOutputSchema;

                  return {
                    id: `auth-${index}`,
                    title: (
                      <Flex align="center" gap={8}>
                        <Text size="2" weight="strong">
                          {method.name}
                        </Text>
                        <MonoCode>{method.key}</MonoCode>
                        <Badge color="blue" size="1">
                          {method.type}
                        </Badge>
                      </Flex>
                    ),
                    content: (
                      <Flex direction="column" gap={16}>
                        {method.scopes && method.scopes.length > 0 && (
                          <Flex direction="column" gap={8}>
                            <Text size="2" weight="strong">
                              Scopes
                            </Text>
                            <Flex direction="column" gap={4}>
                              {method.scopes.map(
                                (
                                  scope: { id?: string; description?: string; title?: string },
                                  idx: number
                                ) => (
                                  <Flex
                                    key={scope.id || idx}
                                    align="center"
                                    gap={12}
                                    style={{
                                      padding: '6px 0',
                                      borderBottom: '1px solid #f1f5f9'
                                    }}
                                  >
                                    <MonoCode style={{ minWidth: 180 }}>{scope.id}</MonoCode>
                                    <Text size="2" color="gray600">
                                      {scope.description || scope.title}
                                    </Text>
                                  </Flex>
                                )
                              )}
                            </Flex>
                          </Flex>
                        )}

                        {method.capabilities &&
                          Object.entries(
                            method.capabilities as Record<
                              string,
                              { enabled?: boolean; description?: string }
                            >
                          ).filter(([_, v]) => v?.enabled).length > 0 && (
                            <Flex direction="column" gap={8}>
                              <Text size="2" weight="strong">
                                Capabilities
                              </Text>
                              <Flex direction="column" gap={4}>
                                {Object.entries(
                                  method.capabilities as Record<
                                    string,
                                    { enabled?: boolean; description?: string }
                                  >
                                )
                                  .filter(([_, v]) => v?.enabled)
                                  .map(([key, value]) => (
                                    <Flex
                                      key={key}
                                      align="center"
                                      gap={12}
                                      style={{
                                        padding: '6px 0',
                                        borderBottom: '1px solid #f1f5f9'
                                      }}
                                    >
                                      <Badge color="green" size="2">
                                        {key}
                                      </Badge>
                                      {value?.description && (
                                        <Text size="2" color="gray600">
                                          {value.description}
                                        </Text>
                                      )}
                                    </Flex>
                                  ))}
                              </Flex>
                            </Flex>
                          )}
                        {hasBothSchemas ? (
                          <Flex gap={32}>
                            <div style={{ flex: 1 }}>
                              <SchemaViewer schema={method.inputSchema} title="Input Schema" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <SchemaViewer
                                schema={method.outputSchema}
                                title="Output Schema"
                              />
                            </div>
                          </Flex>
                        ) : (
                          <>
                            {hasInputSchema && (
                              <SchemaViewer schema={method.inputSchema} title="Input Schema" />
                            )}
                            {hasOutputSchema && (
                              <SchemaViewer
                                schema={method.outputSchema}
                                title="Output Schema"
                              />
                            )}
                          </>
                        )}
                      </Flex>
                    )
                  };
                })}
              />
            )}
          </Flex>
        )}
      </Group.Content>
    </Group.Wrapper>
  );
};
