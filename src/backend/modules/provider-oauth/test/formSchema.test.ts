import { describe, expect, it } from 'vitest';
import { formSchema } from '../src/lib/formSchema';

describe('formSchema', () => {
  describe('validation', () => {
    it('should validate a form with text field', () => {
      const validForm = {
        fields: [
          {
            type: 'text',
            label: 'Username',
            key: 'username',
            isRequired: true,
            placeholder: 'Enter username'
          }
        ]
      };

      const result = formSchema.validate(validForm);
      expect(result.success).toBe(true);
    });

    it('should validate a form with password field', () => {
      const validForm = {
        fields: [
          {
            type: 'password',
            label: 'Password',
            key: 'password',
            isRequired: true
          }
        ]
      };

      const result = formSchema.validate(validForm);
      expect(result.success).toBe(true);
    });

    it('should validate a form with select field', () => {
      const validForm = {
        fields: [
          {
            type: 'select',
            label: 'Environment',
            key: 'env',
            isRequired: false,
            options: [
              { label: 'Production', value: 'prod' },
              { label: 'Development', value: 'dev' }
            ]
          }
        ]
      };

      const result = formSchema.validate(validForm);
      expect(result.success).toBe(true);
    });

    it('should validate a form with multiple fields', () => {
      const validForm = {
        fields: [
          {
            type: 'text',
            label: 'Client ID',
            key: 'clientId',
            isRequired: true
          },
          {
            type: 'password',
            label: 'Client Secret',
            key: 'clientSecret',
            isRequired: true
          },
          {
            type: 'select',
            label: 'Region',
            key: 'region',
            options: [
              { label: 'US', value: 'us' },
              { label: 'EU', value: 'eu' }
            ]
          }
        ]
      };

      const result = formSchema.validate(validForm);
      expect(result.success).toBe(true);
    });

    it('should allow optional fields', () => {
      const validForm = {
        fields: [
          {
            type: 'text',
            label: 'Name',
            key: 'name'
            // isRequired and placeholder are optional
          }
        ]
      };

      const result = formSchema.validate(validForm);
      expect(result.success).toBe(true);
    });

    it('should reject invalid field types', () => {
      const invalidForm = {
        fields: [
          {
            type: 'invalid_type',
            label: 'Test',
            key: 'test'
          }
        ]
      };

      const result = formSchema.validate(invalidForm);
      expect(result.success).toBe(false);
    });

    it('should reject text field without required properties', () => {
      const invalidForm = {
        fields: [
          {
            type: 'text',
            // missing label and key
          }
        ]
      };

      const result = formSchema.validate(invalidForm);
      expect(result.success).toBe(false);
    });

    it('should reject select field without options', () => {
      const invalidForm = {
        fields: [
          {
            type: 'select',
            label: 'Test',
            key: 'test'
            // missing options
          }
        ]
      };

      const result = formSchema.validate(invalidForm);
      expect(result.success).toBe(false);
    });

    it('should reject select field with invalid options', () => {
      const invalidForm = {
        fields: [
          {
            type: 'select',
            label: 'Test',
            key: 'test',
            options: [
              { label: 'Option 1' } // missing value
            ]
          }
        ]
      };

      const result = formSchema.validate(invalidForm);
      expect(result.success).toBe(false);
    });

    it('should reject empty fields array is still valid', () => {
      const emptyForm = {
        fields: []
      };

      const result = formSchema.validate(emptyForm);
      expect(result.success).toBe(true);
    });

    it('should reject missing fields property', () => {
      const invalidForm = {};

      const result = formSchema.validate(invalidForm);
      expect(result.success).toBe(false);
    });

    it('should reject non-array fields', () => {
      const invalidForm = {
        fields: 'not an array'
      };

      const result = formSchema.validate(invalidForm);
      expect(result.success).toBe(false);
    });

    it('should validate placeholder as optional', () => {
      const formWithPlaceholder = {
        fields: [
          {
            type: 'text',
            label: 'Email',
            key: 'email',
            placeholder: 'user@example.com'
          }
        ]
      };

      const formWithoutPlaceholder = {
        fields: [
          {
            type: 'text',
            label: 'Email',
            key: 'email'
          }
        ]
      };

      expect(formSchema.validate(formWithPlaceholder).success).toBe(true);
      expect(formSchema.validate(formWithoutPlaceholder).success).toBe(true);
    });

    it('should validate isRequired as optional boolean', () => {
      const formWithRequired = {
        fields: [
          {
            type: 'text',
            label: 'Name',
            key: 'name',
            isRequired: true
          }
        ]
      };

      const formWithoutRequired = {
        fields: [
          {
            type: 'text',
            label: 'Name',
            key: 'name'
          }
        ]
      };

      expect(formSchema.validate(formWithRequired).success).toBe(true);
      expect(formSchema.validate(formWithoutRequired).success).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const complexForm = {
        fields: [
          {
            type: 'select',
            label: 'Country',
            key: 'country',
            isRequired: true,
            options: [
              { label: 'United States', value: 'us' },
              { label: 'Canada', value: 'ca' },
              { label: 'United Kingdom', value: 'uk' },
              { label: 'Germany', value: 'de' }
            ]
          }
        ]
      };

      const result = formSchema.validate(complexForm);
      expect(result.success).toBe(true);
    });
  });
});
