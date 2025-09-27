import { ServiceError, validationError } from '@metorial/error';
import Ajv from 'ajv';
import metaSchema from 'ajv/dist/refs/json-schema-draft-07.json'; // or 'draft-2020-12'

let ajv = new Ajv();

try {
  ajv.addMetaSchema(metaSchema);
} catch (e: any) {
  if (!e.message.includes('already exists')) throw e;
}

export let validateJsonSchema = (schema: object) => {
  try {
    let valid = ajv.validateSchema(schema);

    if (!valid) {
      throw new ServiceError(
        validationError({
          message: 'Invalid JSON Schema',
          entity: 'jsonSchema',
          errors:
            ajv.errors?.map(err => ({
              code: 'invalid_json_schema',
              message: err.message ?? 'Invalid JSON Schema',
              path: err.instancePath.split('/').filter(Boolean)
            })) ?? []
        })
      );
    }
  } catch (e: any) {
    throw new ServiceError(
      validationError({
        message: 'Invalid JSON Schema',
        entity: 'jsonSchema',
        errors: [
          {
            code: 'invalid_json_schema',
            message: 'Invalid JSON Schema'
          }
        ]
      })
    );
  }
};
