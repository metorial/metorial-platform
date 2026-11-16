# `@lowerdeck/validation`

Comprehensive validation framework with composable validators and modifiers. Define schemas with full TypeScript support and get detailed error messages.

## Installation

```bash
npm install @lowerdeck/validation
yarn add @lowerdeck/validation
bun add @lowerdeck/validation
pnpm add @lowerdeck/validation
```

## Usage

### Basic Validation

```typescript
import { string, number, object, array } from '@lowerdeck/validation';

// String validation
const nameSchema = string().min(2).max(50);
const result = nameSchema.validate('John');
// { success: true, value: 'John' }

// Number validation
const ageSchema = number().min(0).max(120).integer();
ageSchema.validate(25); // { success: true, value: 25 }

// Object validation
const userSchema = object({
  name: string().min(2),
  email: string().email(),
  age: number().min(18).optional()
});

const user = userSchema.validate({
  name: 'John',
  email: 'john@example.com'
});
// { success: true, value: { name: 'John', email: 'john@example.com' } }
```

### String Modifiers

```typescript
import { string } from '@lowerdeck/validation';

// Length and pattern validation
string()
  .length(10)                    // exact length
  .min(5).max(100)               // length range
  .regex(/^[A-Z]/)               // regex pattern
  .email()                       // email format
  .url()                         // URL format
  .ip()                          // IP address
  .startsWith('https://')        // starts with
  .endsWith('.com')              // ends with
  .includes('example')           // contains
  .oneOf(['red', 'green', 'blue']) // enum values
  .validate('value');

// Transformers
string()
  .trim()                        // trim whitespace
  .case('lower')                 // lowercase/uppercase
  .validate(' HELLO ');
// { success: true, value: 'hello' }
```

### Number Modifiers

```typescript
import { number } from '@lowerdeck/validation';

number()
  .min(0)                        // minimum value
  .max(100)                      // maximum value
  .integer()                     // must be integer
  .positive()                    // must be positive
  .multipleOf(5)                 // must be multiple of
  .validate(25);
```

### Array and Object Validation

```typescript
import { array, object, string, number } from '@lowerdeck/validation';

// Array validation
const tagsSchema = array(string()).min(1).max(5);
tagsSchema.validate(['javascript', 'typescript']);

// Nested objects
const postSchema = object({
  title: string().min(1).max(200),
  tags: array(string()).min(1),
  author: object({
    name: string(),
    email: string().email()
  })
});
```

### Optional and Nullable

```typescript
import { string, optional, nullable } from '@lowerdeck/validation';

// Optional fields (can be undefined)
object({
  name: string(),
  nickname: optional(string())
});

// Nullable fields (can be null)
object({
  name: string(),
  middleName: nullable(string())
});
```

### Union Types

```typescript
import { union, string, number } from '@lowerdeck/validation';

// Accept multiple types
const idSchema = union([string(), number()]);
idSchema.validate('123');  // valid
idSchema.validate(123);    // valid
```

### Error Handling

```typescript
const schema = string().email();
const result = schema.validate('invalid-email');

if (!result.success) {
  console.log(result.errors);
  // [
  //   {
  //     path: [],
  //     message: 'Invalid email format',
  //     code: 'invalid_email'
  //   }
  // ]
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
