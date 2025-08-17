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
import { JsonSchemaProperty } from './types';
import { generateUniqueId } from './utils';

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
  property: JsonSchemaProperty;
  onUpdate: (oldName: string, property: JsonSchemaProperty) => void;
  onDelete: (name: string) => void;
  level?: number;
}

export let PropertyEditor = ({ property, onUpdate, onDelete, level = 0 }: Props) => {
  let [isExpanded, setIsExpanded] = useState(true);
  let [localProperty, setLocalProperty] = useState(property);

  let updateLocal = (updates: Partial<JsonSchemaProperty>) => {
    let updated = { ...localProperty, ...updates };
    setLocalProperty(updated);
    onUpdate(property.name, updated);
  };

  let addNestedProperty = () => {
    let id = generateUniqueId();
    let name = `property_${Object.keys(localProperty.properties || {}).length + 1}`;

    let newNestedProp: JsonSchemaProperty = {
      id,
      name,
      type: 'string',
      required: false
    };

    updateLocal({
      properties: {
        ...localProperty.properties,
        [name]: newNestedProp
      }
    });
  };

  let updateNestedProperty = (oldName: string, updatedProp: JsonSchemaProperty) => {
    let newProperties = { ...localProperty.properties };

    if (oldName !== updatedProp.name) {
      delete newProperties[oldName];
    }

    newProperties[updatedProp.name] = updatedProp;

    updateLocal({ properties: newProperties });
  };

  let deleteNestedProperty = (name: string) => {
    let newProperties = { ...localProperty.properties };
    delete newProperties[name];
    updateLocal({ properties: newProperties });
  };

  let addArrayItem = () => {
    updateLocal({
      items: {
        id: generateUniqueId(),
        name: 'item',
        type: 'string',
        required: false
      }
    });
  };

  let updateArrayItem = (updatedProp: JsonSchemaProperty) => {
    updateLocal({ items: updatedProp });
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
        <Badge size="1" color={getTypeColor(localProperty.type)}>
          {localProperty.type}
        </Badge>
        <PropertyName>{localProperty.name}</PropertyName>

        {localProperty.required && <RequiredBadge>Required</RequiredBadge>}

        <Actions onClick={e => e.stopPropagation()}>
          <Tooltip content="Delete Property">
            <Button
              className="delete"
              onClick={() => onDelete(localProperty.name)}
              title="Delete Property"
              iconRight={<RiDeleteBin4Line size={14} />}
              variant="outline"
              size="2"
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
                    value={localProperty.name}
                    onChange={e => updateLocal({ name: e.target.value })}
                  />
                </FormGroup>
                <FormGroup>
                  <Select
                    label="Type"
                    value={localProperty.type}
                    onChange={v =>
                      updateLocal({
                        type: v as JsonSchemaProperty['type'],
                        properties: v === 'object' ? {} : undefined,
                        items: v === 'array' ? undefined : undefined
                      })
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
                    value={localProperty.description || ''}
                    onChange={e => updateLocal({ description: e.target.value })}
                    as="textarea"
                    minRows={3}
                  />
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup>
                  <Checkbox
                    checked={localProperty.required}
                    onCheckedChange={checked => updateLocal({ required: checked })}
                    label="Required"
                  />
                </FormGroup>
              </FormRow>

              {/* String-specific validations */}
              {localProperty.type === 'string' && (
                <>
                  <FormRow>
                    <FormGroup>
                      <Input
                        label="Min Length"
                        type="number"
                        value={localProperty.minLength || ''}
                        onChange={e =>
                          updateLocal({
                            minLength: e.target.value ? parseInt(e.target.value) : undefined
                          })
                        }
                      />
                    </FormGroup>
                    <FormGroup>
                      <Input
                        label="Max Length"
                        type="number"
                        value={localProperty.maxLength || ''}
                        onChange={e =>
                          updateLocal({
                            maxLength: e.target.value ? parseInt(e.target.value) : undefined
                          })
                        }
                      />
                    </FormGroup>
                  </FormRow>
                </>
              )}

              {/* Number-specific validations */}
              {(localProperty.type === 'number' || localProperty.type === 'integer') && (
                <FormRow>
                  <FormGroup>
                    <Input
                      label="Minimum"
                      type="number"
                      value={localProperty.minimum || ''}
                      onChange={e =>
                        updateLocal({
                          minimum: e.target.value ? parseFloat(e.target.value) : undefined
                        })
                      }
                    />
                  </FormGroup>
                  <FormGroup>
                    <Input
                      label="Maximum"
                      type="number"
                      value={localProperty.maximum || ''}
                      onChange={e =>
                        updateLocal({
                          maximum: e.target.value ? parseFloat(e.target.value) : undefined
                        })
                      }
                    />
                  </FormGroup>
                </FormRow>
              )}

              {/* Object nested properties */}
              {localProperty.type === 'object' && (
                <NestedProperties>
                  {localProperty.properties &&
                    Object.entries(localProperty.properties).map(([name, nestedProp]) => (
                      <PropertyEditor
                        key={nestedProp.id}
                        property={{ ...nestedProp, name }}
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
                    >
                      Add Property
                    </Button>
                  </div>
                </NestedProperties>
              )}

              {/* Array item schema */}
              {localProperty.type === 'array' && (
                <NestedProperties>
                  {!localProperty.items ? (
                    <Button onClick={addArrayItem} iconLeft={<RiAddLine size={12} />}>
                      Add Array Item Schema
                    </Button>
                  ) : (
                    <>
                      <InputLabel style={{ marginBottom: '8px' }}>
                        Array Item Schema
                      </InputLabel>
                      <PropertyEditor
                        property={localProperty.items}
                        onUpdate={(_, updated) => updateArrayItem(updated)}
                        onDelete={() => updateLocal({ items: undefined })}
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
