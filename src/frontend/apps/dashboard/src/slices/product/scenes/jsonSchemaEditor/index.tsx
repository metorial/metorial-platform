import { CodeBlock } from '@metorial/code';
import { Button, Input, theme } from '@metorial/ui';
import { RiAddLine, RiFullscreenExitLine } from '@remixicon/react';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { PropertyEditor } from './propertyEditor';
import { JsonSchema, JsonSchemaProperty } from './types';
import { generateUniqueId } from './utils';

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

  &[data-view='full'] {
    height: calc(100% - 60px);
  }

  &[data-view='embedded'] {
    height: 100%;
  }
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
`;

let Header = styled.header`
  padding: 0px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;

  h1 {
    font-size: 18px;
    font-weight: 600;
  }
`;

export let SchemaEditor = (p: {
  title: string;
  view?: 'embedded' | 'full';
  setView?: (view: 'embedded' | 'full') => void;

  onChange?: (schema: JsonSchema) => void;
  value?: JsonSchema;
}) => {
  let [schema, setSchema] = useState<JsonSchema>({
    type: 'object',
    title: p.title,
    description: '',
    properties: {},
    required: []
  });

  useEffect(() => {
    if (p.value) {
      let jsonSchema = p.value;
      setSchema({
        type: 'object',
        title: jsonSchema.title || 'Imported Schema',
        description: jsonSchema.description || '',
        properties: jsonSchema.properties || {},
        required: jsonSchema.required || []
      });
    }
  }, [p.value]);

  let properties = Object.entries(schema.properties).map(([name, prop]) => ({
    ...prop,
    name
  }));

  let addProperty = () => {
    let id = generateUniqueId();
    let name = `property_${Object.keys(schema.properties).length + 1}`;

    setSchema(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [name]: {
          id,
          name,
          type: 'string',
          required: false
        }
      }
    }));
  };

  let updateProperty = (oldName: string, updatedProperty: JsonSchemaProperty) => {
    setSchema(prev => {
      let newProperties = { ...prev.properties };

      // Remove old property if name changed
      if (oldName !== updatedProperty.name) {
        delete newProperties[oldName];
      }

      // Add updated property
      newProperties[updatedProperty.name] = updatedProperty;

      // Update required array
      let newRequired = prev.required.filter(req => req !== oldName);
      if (updatedProperty.required) {
        newRequired.push(updatedProperty.name);
      }

      return {
        ...prev,
        properties: newProperties,
        required: newRequired
      };
    });
  };

  let deleteProperty = (name: string) => {
    setSchema(prev => {
      let newProperties = { ...prev.properties };
      delete newProperties[name];

      return {
        ...prev,
        properties: newProperties,
        required: prev.required.filter(req => req !== name)
      };
    });
  };

  let generateJsonSchema = (schema: JsonSchema) => {
    let convertProperty = (prop: JsonSchemaProperty): any => {
      let result: any = {
        type: prop.type
      };

      if (prop.description) result.description = prop.description;
      if (prop.default !== undefined) result.default = prop.default;
      if (prop.enum) result.enum = prop.enum;

      // String validations
      if (prop.minLength !== undefined) result.minLength = prop.minLength;
      if (prop.maxLength !== undefined) result.maxLength = prop.maxLength;
      if (prop.pattern) result.pattern = prop.pattern;
      if (prop.format) result.format = prop.format;

      // Number validations
      if (prop.minimum !== undefined) result.minimum = prop.minimum;
      if (prop.maximum !== undefined) result.maximum = prop.maximum;
      if (prop.multipleOf !== undefined) result.multipleOf = prop.multipleOf;

      // Object properties
      if (prop.type === 'object' && prop.properties) {
        result.properties = {};
        Object.entries(prop.properties).forEach(([name, nestedProp]) => {
          result.properties[name] = convertProperty(nestedProp);
        });
        let requiredProps = Object.values(prop.properties)
          .filter(p => p.required)
          .map(p => p.name);
        if (requiredProps.length > 0) {
          result.required = requiredProps;
        }
      }

      // Array properties
      if (prop.type === 'array') {
        if (prop.items) result.items = convertProperty(prop.items);
        if (prop.minItems !== undefined) result.minItems = prop.minItems;
        if (prop.maxItems !== undefined) result.maxItems = prop.maxItems;
        if (prop.uniqueItems) result.uniqueItems = prop.uniqueItems;
      }

      return result;
    };

    let result = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: schema.title,
      description: schema.description,
      properties: {} as any,
      required: schema.required
    };

    Object.entries(schema.properties).forEach(([name, prop]) => {
      result.properties[name] = convertProperty(prop);
    });

    return result;
  };

  let currentSchema = useMemo(() => generateJsonSchema(schema), [schema]);

  useEffect(() => {
    p.onChange?.(currentSchema as any);
  }, [currentSchema, p.onChange]);

  return (
    <Container data-view={p.view}>
      {p.view === 'full' && (
        <Header>
          <h1>{p.title}</h1>

          <Button
            iconLeft={<RiFullscreenExitLine />}
            variant="outline"
            size="2"
            onClick={() => p.setView?.('embedded')}
          >
            Collapse
          </Button>
        </Header>
      )}

      <Wrapper data-view={p.view}>
        <Main style={{ width: p.view === 'full' ? '45vw' : '450px' }}>
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
              >
                Add Property
              </Button>
            </SectionHeader>

            {properties.length === 0 ? (
              <EmptyState>
                <p>No properties defined yet</p>
              </EmptyState>
            ) : (
              properties.map(property => (
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
