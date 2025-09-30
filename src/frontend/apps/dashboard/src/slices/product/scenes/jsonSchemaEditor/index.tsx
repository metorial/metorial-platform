import { CodeBlock } from '@metorial/code';
import { Button, Input, theme } from '@metorial/ui';
import { RiAddLine, RiFullscreenExitLine } from '@remixicon/react';
import { throttle } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { PropertyEditor } from './propertyEditor';
import {
  createEmptyProperty,
  fromJsonSchema,
  JsonPropertyStored,
  JsonSchema,
  toJsonSchema
} from './types';

let Container = styled.div`
  background-color: ${theme.colors.gray200};
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;

  &[data-view='full'] {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background-color: white;
  }

  &[data-view='embedded'] {
    width: 100%;
    height: 600px;
  }
`;

let Wrapper = styled.div`
  display: flex;
  flex-grow: 1;
  height: calc(100% - 60px);
`;

let Main = styled.main`
  background: white;
  border-right: 1px solid ${theme.colors.gray300};
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow-y: auto;
  flex-shrink: 0;
`;

let SchemaInfo = styled.div`
  padding: 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let InfoField = styled.div`
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

let PropertiesSection = styled.div`
  flex: 1;
  padding: 20px;
`;

let SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

let SectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: ${theme.colors.gray800};
  margin: 0;
`;

let EmptyState = styled.div`
  text-align: center;
  color: ${theme.colors.gray600};
  padding: 20px;

  p {
    font-size: 14px;
    font-weight: 500;
  }
`;

let Preview = styled.aside`
  flex-grow: 1;
  height: 100%;

  & > div {
    height: 100%;
    overflow-y: auto;
  }
`;

let Header = styled.header`
  padding: 0px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  background: white;

  h1 {
    font-size: 18px;
    font-weight: 600;
  }
`;

let getSchema = (title: string, input: any) =>
  fromJsonSchema(
    input
      ? {
          type: 'object',
          title: input.title || 'Imported Schema',
          description: input.description || '',
          properties: input.properties || {},
          required: input.required || []
        }
      : {
          type: 'object',
          title: title,
          description: '',
          properties: {},
          required: []
        }
  );

export let SchemaEditor = (p: {
  title: string;

  onChange?: (schema: any) => void;
  value?: any;
}) => {
  let [schema, setSchema] = useState<JsonSchema>(() => getSchema(p.title, p.value));
  useEffect(() => setSchema(getSchema(p.title, p.value)), [p.value]);

  let [view, setView] = useState<'embedded' | 'full'>('embedded');

  let addProperty = () => {
    setSchema(prev => ({
      ...prev,
      children: {
        properties: [...(prev.children?.properties || []), createEmptyProperty('', 'string')]
      }
    }));
  };

  let updateProperty = (updatedProperty: JsonPropertyStored) => {
    setSchema(prev => {
      let newProperties = { ...prev };

      newProperties.children = {
        ...newProperties.children,
        properties: newProperties.children.properties.map(prop =>
          prop.id == updatedProperty.id ? updatedProperty : prop
        )
      };

      return newProperties;
    });
  };

  let deleteProperty = (property: JsonPropertyStored) => {
    setSchema(prev => {
      let newProperties = { ...prev };

      newProperties.children = {
        ...newProperties.children,
        properties: newProperties.children.properties.filter(prop => prop.id !== property.id)
      };

      return newProperties;
    });
  };

  let currentSchema = useMemo(() => toJsonSchema(schema), [schema]);
  let onChangeThrottled = useMemo(
    () =>
      throttle(
        (newSchema: JsonSchema) => {
          p.onChange?.(newSchema);
        },
        500,
        { leading: false, trailing: true }
      ),
    [p.onChange]
  );
  useEffect(() => onChangeThrottled(currentSchema as any), [currentSchema]);

  return (
    <Container data-view={view}>
      <Header>
        <h1>{p.title}</h1>

        <Button
          iconLeft={<RiFullscreenExitLine />}
          variant="outline"
          size="2"
          onClick={() => setView(v => (v === 'embedded' ? 'full' : 'embedded'))}
          type="button"
        >
          Collapse
        </Button>
      </Header>

      <Wrapper data-view={view}>
        <Main style={{ width: view === 'full' ? '45vw' : '450px' }}>
          <SchemaInfo>
            <InfoField>
              <Input
                label="Schema Title"
                value={schema.title || ''}
                onChange={e => setSchema(prev => ({ ...prev, title: e.target.value }))}
              />
            </InfoField>
            <InfoField>
              <Input
                label="Description"
                value={schema.description || ''}
                onChange={e => setSchema(prev => ({ ...prev, description: e.target.value }))}
                as="textarea"
                minRows={3}
              />
            </InfoField>
          </SchemaInfo>

          <PropertiesSection>
            <SectionHeader>
              <SectionTitle>Properties</SectionTitle>
              <Button
                onClick={addProperty}
                iconLeft={<RiAddLine />}
                size="2"
                variant="outline"
                type="button"
              >
                Add Property
              </Button>
            </SectionHeader>

            {schema.children.properties.length === 0 ? (
              <EmptyState>
                <p>No properties defined yet</p>
              </EmptyState>
            ) : (
              schema.children.properties.map(property => (
                <PropertyEditor
                  key={property.id}
                  property={property}
                  onUpdate={updateProperty}
                  onDelete={deleteProperty}
                />
              ))
            )}
          </PropertiesSection>
        </Main>

        <Preview>
          <CodeBlock
            language="json"
            code={JSON.stringify(currentSchema, null, 2)}
            variant="seamless"
            padding="15px"
          />
        </Preview>
      </Wrapper>
    </Container>
  );
};
