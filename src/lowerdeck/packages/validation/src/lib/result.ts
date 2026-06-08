import { ValidationError, ValidationResult } from './types';

export let success = <T>(value: T): ValidationResult<T> => ({
  success: true,
  value
});

export let error = (errors: ValidationError[]): ValidationResult<any> => ({
  success: false,
  errors
});
