import { describe, expect, it, test } from 'vitest';
import { jsonSchemaToOpenApi } from './openApi';
import { JsonSchema } from './types';

describe('jsonSchemaToOpenApi', () => {
  describe('Basic Type Conversions', () => {
    it('should convert string schema', () => {
      const jsonSchema: JsonSchema = {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[A-Za-z]+$',
        format: 'email'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[A-Za-z]+$',
        format: 'email'
      });
    });

    it('should convert number schema', () => {
      const jsonSchema: JsonSchema = {
        type: 'number',
        minimum: 0,
        maximum: 100,
        multipleOf: 0.5
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'number',
        minimum: 0,
        maximum: 100,
        multipleOf: 0.5
      });
    });

    it('should convert integer schema', () => {
      const jsonSchema: JsonSchema = {
        type: 'integer',
        minimum: 1,
        maximum: 1000
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'integer',
        minimum: 1,
        maximum: 1000
      });
    });

    it('should convert boolean schema', () => {
      const jsonSchema: JsonSchema = {
        type: 'boolean'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'boolean'
      });
    });

    it('should convert array schema', () => {
      const jsonSchema: JsonSchema = {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
        uniqueItems: true
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
        uniqueItems: true
      });
    });

    it('should convert object schema', () => {
      const jsonSchema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        },
        required: ['name'],
        additionalProperties: false
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        },
        required: ['name'],
        additionalProperties: false
      });
    });
  });

  describe('Boolean Schemas', () => {
    it('should convert true boolean schema', () => {
      const result = jsonSchemaToOpenApi(true);
      expect(result).toEqual({});
    });

    it('should convert false boolean schema', () => {
      const result = jsonSchemaToOpenApi(false);
      expect(result).toEqual({ not: {} });
    });
  });

  describe('Null Type Handling', () => {
    it('should convert null type to nullable by default', () => {
      const jsonSchema: JsonSchema = {
        type: 'null'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        nullable: true
      });
    });

    it('should preserve null type when specified', () => {
      const jsonSchema: JsonSchema = {
        type: 'null'
      };

      const result = jsonSchemaToOpenApi(jsonSchema, { nullHandling: 'preserve' });

      expect(result).toEqual({
        type: 'null'
      });
    });

    it('should remove null type when specified', () => {
      const jsonSchema: JsonSchema = {
        type: 'null'
      };

      const result = jsonSchemaToOpenApi(jsonSchema, { nullHandling: 'remove' });

      expect(result).toEqual({});
    });

    it('should handle array with null type', () => {
      const jsonSchema = {
        type: ['string', 'null'] as any
      } as JsonSchema;

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'string',
        nullable: true
      });
    });

    it('should handle multiple types with null', () => {
      const jsonSchema = {
        type: ['string', 'number', 'null'] as any
      } as JsonSchema;

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        anyOf: [{ type: 'string' }, { type: 'number' }],
        nullable: true
      });
    });
  });

  describe('Exclusive Minimum/Maximum', () => {
    it('should handle numeric exclusiveMinimum', () => {
      const jsonSchema: JsonSchema = {
        type: 'number',
        exclusiveMinimum: 0
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'number',
        minimum: 0,
        exclusiveMinimum: true
      });
    });

    it('should handle boolean exclusiveMinimum', () => {
      const jsonSchema: JsonSchema = {
        type: 'number',
        minimum: 0,
        exclusiveMinimum: true
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'number',
        minimum: 0,
        exclusiveMinimum: true
      });
    });

    it('should handle numeric exclusiveMaximum', () => {
      const jsonSchema: JsonSchema = {
        type: 'number',
        exclusiveMaximum: 100
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'number',
        maximum: 100,
        exclusiveMaximum: true
      });
    });
  });

  describe('References', () => {
    it('should transform $defs reference', () => {
      const jsonSchema: JsonSchema = {
        $ref: '#/$defs/User'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        $ref: '#/components/schemas/User'
      });
    });

    it('should transform definitions reference', () => {
      const jsonSchema: JsonSchema = {
        $ref: '#/definitions/User'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        $ref: '#/components/schemas/User'
      });
    });

    it('should preserve other references', () => {
      const jsonSchema: JsonSchema = {
        $ref: '#/components/schemas/User'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        $ref: '#/components/schemas/User'
      });
    });
  });

  describe('Composition Keywords', () => {
    it('should handle allOf', () => {
      const jsonSchema: JsonSchema = {
        allOf: [
          { type: 'object', properties: { name: { type: 'string' } } },
          { type: 'object', properties: { age: { type: 'integer' } } }
        ]
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        allOf: [
          { type: 'object', properties: { name: { type: 'string' } } },
          { type: 'object', properties: { age: { type: 'integer' } } }
        ]
      });
    });

    it('should handle anyOf', () => {
      const jsonSchema: JsonSchema = {
        anyOf: [{ type: 'string' }, { type: 'number' }]
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        anyOf: [{ type: 'string' }, { type: 'number' }]
      });
    });

    it('should handle oneOf', () => {
      const jsonSchema: JsonSchema = {
        oneOf: [{ type: 'string' }, { type: 'number' }]
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        oneOf: [{ type: 'string' }, { type: 'number' }]
      });
    });

    it('should handle not', () => {
      const jsonSchema: JsonSchema = {
        not: { type: 'string' }
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        not: { type: 'string' }
      });
    });
  });

  describe('Array Items', () => {
    it('should handle single item schema', () => {
      const jsonSchema: JsonSchema = {
        type: 'array',
        items: { type: 'string' }
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'array',
        items: { type: 'string' }
      });
    });

    it('should handle tuple validation (array of items)', () => {
      const jsonSchema: JsonSchema = {
        type: 'array',
        items: [{ type: 'string' }, { type: 'number' }]
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'array',
        items: {
          anyOf: [{ type: 'string' }, { type: 'number' }]
        }
      });
    });
  });

  describe('Common Properties', () => {
    it('should copy common properties', () => {
      const jsonSchema: JsonSchema = {
        type: 'string',
        title: 'User Name',
        description: 'The name of the user',
        default: 'Anonymous',
        enum: ['admin', 'user', 'guest'],
        readOnly: true,
        writeOnly: false,
        deprecated: true
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'string',
        title: 'User Name',
        description: 'The name of the user',
        default: 'Anonymous',
        enum: ['admin', 'user', 'guest'],
        readOnly: true,
        writeOnly: false,
        deprecated: true
      });
    });

    it('should handle const', () => {
      const jsonSchema: JsonSchema = {
        type: 'string',
        const: 'fixed-value'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'string',
        const: 'fixed-value'
      });
    });
  });

  describe('Examples Handling', () => {
    it('should convert examples to example for OpenAPI 3.0', () => {
      const jsonSchema: JsonSchema = {
        type: 'string',
        examples: ['example1', 'example2', 'example3']
      };

      const result = jsonSchemaToOpenApi(jsonSchema, { openApiVersion: '3.0.0' });

      expect(result).toEqual({
        type: 'string',
        example: 'example1'
      });
    });

    it('should preserve examples for OpenAPI 3.1', () => {
      const jsonSchema: JsonSchema = {
        type: 'string',
        examples: ['example1', 'example2', 'example3']
      };

      const result = jsonSchemaToOpenApi(jsonSchema, { openApiVersion: '3.1.0' });

      expect(result).toEqual({
        type: 'string',
        examples: ['example1', 'example2', 'example3']
      });
    });

    it('should handle empty examples array', () => {
      const jsonSchema: JsonSchema = {
        type: 'string',
        examples: []
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'string'
      });
    });
  });

  describe('Additional Properties', () => {
    it('should handle boolean additionalProperties', () => {
      const jsonSchema: JsonSchema = {
        type: 'object',
        additionalProperties: true
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'object',
        additionalProperties: true
      });
    });

    it('should handle schema additionalProperties', () => {
      const jsonSchema: JsonSchema = {
        type: 'object',
        additionalProperties: { type: 'string' }
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'object',
        additionalProperties: { type: 'string' }
      });
    });
  });

  describe('Complex Schemas', () => {
    it('should handle nested object with all features', () => {
      const jsonSchema: JsonSchema = {
        type: 'object',
        title: 'User',
        description: 'A user object',
        properties: {
          id: {
            type: 'integer',
            minimum: 1,
            description: 'User ID'
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Full name'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address'
          },
          roles: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['admin', 'user', 'guest']
            },
            minItems: 1,
            uniqueItems: true
          },
          profile: {
            type: 'object',
            properties: {
              avatar: { type: 'string', format: 'uri' },
              bio: { type: 'string' }
            },
            additionalProperties: false
          }
        },
        required: ['id', 'name', 'email'],
        additionalProperties: false
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'object',
        title: 'User',
        description: 'A user object',
        properties: {
          id: {
            type: 'integer',
            minimum: 1,
            description: 'User ID'
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Full name'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address'
          },
          roles: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['admin', 'user', 'guest']
            },
            minItems: 1,
            uniqueItems: true
          },
          profile: {
            type: 'object',
            properties: {
              avatar: { type: 'string', format: 'uri' },
              bio: { type: 'string' }
            },
            additionalProperties: false
          }
        },
        required: ['id', 'name', 'email'],
        additionalProperties: false
      });
    });

    it('should handle composition with types', () => {
      const jsonSchema: any = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { type: 'object', properties: { b: { type: 'number' } } }
        ],
        type: 'object'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        type: 'object',
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { type: 'object', properties: { b: { type: 'number' } } }
        ]
      });
    });
  });

  describe('Preserve JSON Schema Keywords', () => {
    it('should remove JSON Schema keywords by default', () => {
      const jsonSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://example.com/user.schema.json',
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      } as JsonSchema;

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).not.toHaveProperty('$schema');
      expect(result).not.toHaveProperty('$id');
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty schema', () => {
      const jsonSchema = {} as JsonSchema;

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({});
    });

    it('should handle schema with only $ref', () => {
      const jsonSchema: JsonSchema = {
        $ref: '#/$defs/User'
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        $ref: '#/components/schemas/User'
      });
    });

    it('should handle deeply nested composition', () => {
      const jsonSchema: JsonSchema = {
        anyOf: [
          {
            allOf: [{ type: 'string' }]
          },
          {
            oneOf: [{ type: 'number' }, { type: 'integer' }]
          }
        ]
      };

      const result = jsonSchemaToOpenApi(jsonSchema);

      expect(result).toEqual({
        anyOf: [
          {
            allOf: [{ type: 'string' }]
          },
          {
            oneOf: [{ type: 'number' }, { type: 'integer' }]
          }
        ]
      });
    });
  });

  describe('Options Testing', () => {
    test.each([
      ['3.0.0', 'example1'],
      ['3.1.0', ['example1', 'example2']]
    ])('should handle examples correctly for OpenAPI %s', (version, expected) => {
      const jsonSchema: JsonSchema = {
        type: 'string',
        examples: ['example1', 'example2']
      };

      const result = jsonSchemaToOpenApi(jsonSchema, {
        openApiVersion: version as '3.0.0' | '3.1.0'
      });

      if (version === '3.0.0') {
        expect(result).toHaveProperty('example', expected);
        expect(result).not.toHaveProperty('examples');
      } else {
        expect(result).toHaveProperty('examples', expected);
        expect(result).not.toHaveProperty('example');
      }
    });

    test.each([
      ['nullable', { nullable: true }],
      ['remove', {}],
      ['preserve', { type: 'null' }]
    ])('should handle null types with %s option', (nullHandling, expected) => {
      const jsonSchema: JsonSchema = {
        type: 'null'
      };

      const result = jsonSchemaToOpenApi(jsonSchema, {
        nullHandling: nullHandling as 'nullable' | 'remove' | 'preserve'
      });

      expect(result).toEqual(expected);
    });
  });
});
