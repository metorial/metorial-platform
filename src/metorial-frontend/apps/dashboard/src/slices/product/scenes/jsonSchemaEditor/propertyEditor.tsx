import {
  Badge,
  Button,
  Checkbox,
  Input,
  InputLabel,
  Select,
  theme,
  Tooltip
} from '@metorial/ui';
import { RiAddLine, RiArrowDownSLine, RiDeleteBin4Line } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import styled from 'styled-components';
import { createEmptyProperty, JsonPropertyStored, JsonSchemaProperty } from './types';

let Container = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  margin-bottom: 12px;
  background: white;
  transition: all 0.2s ease;
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  gap: 10px;
`;

let PropertyName = styled.span`
  font-weight: 500;
  color: ${theme.colors.gray800};
  font-size: 14px;
  flex: 1;
`;

let RequiredBadge = styled.span`
  background: ${theme.colors.orange900};
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  margin-left: 8px;
`;

let Actions = styled.div`
  display: flex;
  gap: 8px;
`;

let Content = styled(motion.div)`
  border-top: 1px solid ${theme.colors.gray300};
  overflow: hidden;
`;

let ContentInner = styled.div`
  padding: 16px;
`;

let FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }

  &.full-width {
    grid-template-columns: 1fr;
  }
`;

let FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

let NestedProperties = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding-left: 16px;
  border-left: 2px solid ${theme.colors.gray300};
`;

let getTypeColor = (type: string) => {
  switch (type) {
    case 'string':
      return 'blue';
    case 'number':
      return 'green';
    case 'integer':
      return 'indigo';
    case 'boolean':
      return 'purple';
    case 'object':
      return 'orange';
    case 'array':
      return 'yellow';
    case 'null':
      return 'gray';
    default:
      return 'gray';
  }
};

interface Props {
  property: JsonPropertyStored;
  onUpdate: (property: JsonPropertyStored) => void;
  onDelete: (property: JsonPropertyStored) => void;
  level?: number;
}

export let PropertyEditor = ({ property, onUpdate, onDelete, level = 0 }: Props) => {
  let [isExpanded, setIsExpanded] = useState(true);
  let [localProperty, setLocalProperty] = useState(property);

  let updateLocal = (
    updates:
      | Partial<JsonPropertyStored>
      | ((current: JsonPropertyStored) => Partial<JsonPropertyStored>)
  ) => {
    let updateRes = typeof updates === 'function' ? updates(localProperty) : updates;
    let updated = { ...localProperty, ...updateRes };
    setLocalProperty(updated);
    onUpdate(updated);
  };

  let addNestedProperty = () => {
    updateLocal({
      children: {
        properties: [
          ...(localProperty.children?.properties || []),
          createEmptyProperty('', 'string')
        ]
      }
    });
  };

  let updateNestedProperty = (updatedProp: JsonPropertyStored) => {
    let newProperties = { ...localProperty };

    newProperties.children = {
      ...newProperties.children,
      properties: (newProperties.children?.properties ?? []).map(prop =>
        prop.id === updatedProp.id ? updatedProp : prop
      )
    };

    updateLocal(newProperties);
  };

  let deleteNestedProperty = (prop: JsonPropertyStored) => {
    updateLocal({
      children: {
        properties: (localProperty.children?.properties ?? []).filter(p => p.id !== prop.id)
      }
    });

    onDelete(prop);
  };

  let addArrayItem = () => {
    updateLocal({
      children: {
        properties: [createEmptyProperty('item', 'string')]
      }
    });
  };

  let updateArrayItem = (updatedProp: JsonPropertyStored) => {
    updateLocal({
      children: {
        properties: [updatedProp]
      }
    });
  };

  return (
    <Container>
      <Header onClick={() => setIsExpanded(!isExpanded)}>
        <RiArrowDownSLine
          size={16}
          style={{
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s'
          }}
        />
        <Badge size="1" color={getTypeColor(localProperty.property.type)}>
          {localProperty.property.type}
        </Badge>
        <PropertyName>{localProperty.property.name}</PropertyName>

        {localProperty.property.required && <RequiredBadge>Required</RequiredBadge>}

        <Actions onClick={e => e.stopPropagation()}>
          <Tooltip content="Delete Property">
            <Button
              className="delete"
              onClick={() => onDelete(localProperty)}
              title="Delete Property"
              iconRight={<RiDeleteBin4Line size={14} />}
              variant="outline"
              size="2"
              type="button"
            />
          </Tooltip>
        </Actions>
      </Header>

      <AnimatePresence>
        {isExpanded && (
          <Content initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
            <ContentInner>
              <FormRow>
                <FormGroup>
                  <Input
                    label="Property Name"
                    value={localProperty.property.name}
                    onChange={e =>
                      updateLocal(p => ({
                        property: { ...p.property, name: e.target.value }
                      }))
                    }
                  />
                </FormGroup>
                <FormGroup>
                  <Select
                    label="Type"
                    value={localProperty.property.type}
                    onChange={v =>
                      updateLocal(p => ({
                        property: { ...p.property, type: v as JsonSchemaProperty['type'] },
                        children:
                          v === 'object' || v === 'array' ? { properties: [] } : undefined
                      }))
                    }
                    items={[
                      { id: 'string', label: 'String' },
                      { id: 'number', label: 'Number' },
                      { id: 'integer', label: 'Integer' },
                      { id: 'boolean', label: 'Boolean' },
                      { id: 'object', label: 'Object' },
                      { id: 'array', label: 'Array' },
                      { id: 'null', label: 'Null' }
                    ]}
                  />
                </FormGroup>
              </FormRow>

              <FormRow className="full-width">
                <FormGroup>
                  <Input
                    label="Description"
                    value={localProperty.property.description || ''}
                    onChange={e =>
                      updateLocal(p => ({
                        property: { ...p.property, description: e.target.value }
                      }))
                    }
                    as="textarea"
                    minRows={3}
                  />
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup>
                  <Checkbox
                    checked={localProperty.property.required}
                    onCheckedChange={checked =>
                      updateLocal(p => ({
                        property: { ...p.property, required: checked }
                      }))
                    }
                    label="Required"
                  />
                </FormGroup>
              </FormRow>

              {/* String-specific validations */}
              {localProperty.property.type === 'string' && (
                <>
                  <FormRow>
                    <FormGroup>
                      <Input
                        label="Min Length"
                        type="number"
                        value={localProperty.property.minLength || ''}
                        onChange={e =>
                          updateLocal(p => ({
                            property: {
                              ...p.property,
                              minLength: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))
                        }
                      />
                    </FormGroup>
                    <FormGroup>
                      <Input
                        label="Max Length"
                        type="number"
                        value={localProperty.property.maxLength || ''}
                        onChange={e =>
                          updateLocal(p => ({
                            property: {
                              ...p.property,
                              maxLength: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))
                        }
                      />
                    </FormGroup>
                  </FormRow>
                </>
              )}

              {/* Number-specific validations */}
              {(localProperty.property.type === 'number' ||
                localProperty.property.type === 'integer') && (
                <FormRow>
                  <FormGroup>
                    <Input
                      label="Minimum"
                      type="number"
                      value={localProperty.property.minimum || ''}
                      onChange={e =>
                        updateLocal(p => ({
                          property: {
                            ...p.property,
                            minimum: e.target.value ? parseFloat(e.target.value) : undefined
                          }
                        }))
                      }
                    />
                  </FormGroup>
                  <FormGroup>
                    <Input
                      label="Maximum"
                      type="number"
                      value={localProperty.property.maximum || ''}
                      onChange={e =>
                        updateLocal(p => ({
                          property: {
                            ...p.property,
                            maximum: e.target.value ? parseFloat(e.target.value) : undefined
                          }
                        }))
                      }
                    />
                  </FormGroup>
                </FormRow>
              )}

              {/* Object nested properties */}
              {localProperty.property.type === 'object' && (
                <NestedProperties>
                  {localProperty.children?.properties &&
                    localProperty.children.properties.map(nestedProp => (
                      <PropertyEditor
                        key={nestedProp.id}
                        property={nestedProp}
                        onUpdate={updateNestedProperty}
                        onDelete={deleteNestedProperty}
                        level={level + 1}
                      />
                    ))}

                  <div>
                    <Button
                      onClick={addNestedProperty}
                      iconLeft={<RiAddLine size={12} />}
                      variant="outline"
                      size="2"
                      type="button"
                    >
                      Add Property
                    </Button>
                  </div>
                </NestedProperties>
              )}

              {/* Array item schema */}
              {localProperty.property.type === 'array' && (
                <NestedProperties>
                  {!localProperty.children?.properties.length ? (
                    <Button
                      onClick={addArrayItem}
                      iconLeft={<RiAddLine size={12} />}
                      type="button"
                      variant="outline"
                      size="2"
                    >
                      Add Array Item Schema
                    </Button>
                  ) : (
                    <>
                      <InputLabel style={{ marginBottom: '8px' }}>
                        Array Item Schema
                      </InputLabel>
                      <PropertyEditor
                        property={localProperty.children.properties[0]}
                        onUpdate={updated => updateArrayItem(updated)}
                        onDelete={() => updateLocal({ children: { properties: [] } })}
                        level={level + 1}
                      />
                    </>
                  )}
                </NestedProperties>
              )}
            </ContentInner>
          </Content>
        )}
      </AnimatePresence>
    </Container>
  );
};
