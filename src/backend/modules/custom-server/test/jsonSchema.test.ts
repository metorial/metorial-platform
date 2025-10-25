import { describe, expect, it } from 'vitest';
import { validateJsonSchema } from '../src/lib/jsonSchema';
import { ServiceError } from '@metorial/error';

describe('validateJsonSchema', () => {
  describe('valid schemas', () => {
    it('should accept a simple valid JSON schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email']
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  street: { type: 'string' },
                  city: { type: 'string' }
                }
              }
            }
          }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with arrays', () => {
      const schema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with enums', () => {
      const schema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending']
          }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with additionalProperties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with pattern', () => {
      const schema = {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            pattern: '^[a-zA-Z0-9]+$'
          }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with minimum and maximum', () => {
      const schema = {
        type: 'object',
        properties: {
          age: {
            type: 'number',
            minimum: 0,
            maximum: 150
          }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept an empty schema object', () => {
      const schema = {};
      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with allOf', () => {
      const schema = {
        allOf: [
          { type: 'object', properties: { name: { type: 'string' } } },
          { type: 'object', properties: { age: { type: 'number' } } }
        ]
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with anyOf', () => {
      const schema = {
        anyOf: [{ type: 'string' }, { type: 'number' }]
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should accept a schema with oneOf', () => {
      const schema = {
        oneOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { type: 'object', properties: { b: { type: 'number' } } }
        ]
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });
  });

  describe('invalid schemas', () => {
    it('should throw ServiceError for invalid type', () => {
      const schema = {
        type: 'invalid_type'
      };

      expect(() => validateJsonSchema(schema)).toThrow(ServiceError);
    });

    it('should throw ServiceError with validation error details for invalid type', () => {
      const schema = {
        type: 'invalid_type'
      };

      try {
        validateJsonSchema(schema);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ServiceError);
        const error = e as ServiceError<any>;
        expect(error.message).toContain('Invalid JSON Schema');
      }
    });

    it('should throw ServiceError for invalid properties definition', () => {
      const schema = {
        type: 'object',
        properties: 'invalid' // should be an object
      };

      expect(() => validateJsonSchema(schema)).toThrow(ServiceError);
    });

    it('should throw ServiceError for invalid required array', () => {
      const schema = {
        type: 'object',
        required: 'invalid' // should be an array
      };

      expect(() => validateJsonSchema(schema)).toThrow(ServiceError);
    });

    it('should throw ServiceError for invalid items definition', () => {
      const schema = {
        type: 'array',
        items: 'invalid' // should be an object or array
      };

      expect(() => validateJsonSchema(schema)).toThrow(ServiceError);
    });

    it('should throw ServiceError for invalid enum value', () => {
      const schema = {
        type: 'string',
        enum: 'invalid' // should be an array
      };

      expect(() => validateJsonSchema(schema)).toThrow(ServiceError);
    });

    it('should throw ServiceError for invalid pattern', () => {
      const schema = {
        type: 'string',
        pattern: ['invalid'] // should be a string
      };

      expect(() => validateJsonSchema(schema)).toThrow(ServiceError);
    });

    it('should throw ServiceError for invalid minimum', () => {
      const schema = {
        type: 'number',
        minimum: 'invalid' // should be a number
      };

      expect(() => validateJsonSchema(schema)).toThrow(ServiceError);
    });

    it('should accept allOf with different types (schema validation only)', () => {
      // Note: allOf with conflicting types is valid at the schema level
      // It would fail at data validation, but that's not what we're testing here
      const schema = {
        allOf: [{ type: 'string' }, { type: 'number' }]
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle deeply nested schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should handle schemas with many properties', () => {
      const properties: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        properties[`field${i}`] = { type: 'string' };
      }

      const schema = {
        type: 'object',
        properties
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should handle schema with $ref (if supported)', () => {
      const schema = {
        type: 'object',
        properties: {
          user: { $ref: '#/definitions/User' }
        },
        definitions: {
          User: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should handle boolean schemas', () => {
      // In JSON Schema, true means allow everything, false means allow nothing
      expect(() => validateJsonSchema(true as any)).not.toThrow();
      expect(() => validateJsonSchema(false as any)).not.toThrow();
    });

    it('should provide meaningful error messages', () => {
      const schema = {
        type: 'object',
        properties: {
          age: {
            type: 'number',
            minimum: 'not a number' // invalid
          }
        }
      };

      try {
        validateJsonSchema(schema);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ServiceError);
        const error = e as ServiceError<any>;
        expect(error.message).toContain('Invalid JSON Schema');
      }
    });
  });

  describe('complex real-world schemas', () => {
    it('should validate a complex API request schema', () => {
      const schema = {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100
          },
          email: {
            type: 'string',
            format: 'email'
          },
          age: {
            type: 'integer',
            minimum: 0,
            maximum: 150
          },
          preferences: {
            type: 'object',
            properties: {
              newsletter: { type: 'boolean' },
              language: {
                type: 'string',
                enum: ['en', 'es', 'fr', 'de']
              }
            }
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 0,
            maxItems: 10
          }
        },
        additionalProperties: false
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });

    it('should validate a schema with conditional validation', () => {
      const schema = {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['person', 'organization'] },
          name: { type: 'string' }
        },
        if: {
          properties: { type: { const: 'person' } }
        },
        then: {
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' }
          },
          required: ['firstName', 'lastName']
        },
        else: {
          properties: {
            companyName: { type: 'string' }
          },
          required: ['companyName']
        }
      };

      expect(() => validateJsonSchema(schema)).not.toThrow();
    });
  });
});
