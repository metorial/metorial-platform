import { base62 } from '@metorial/base62';
import { badRequestError, ServiceError } from '@metorial/error';

let PREFIX = 'cur_';

export class Cursor {
  private constructor(
    public readonly id: string,
    public readonly type: 'after' | 'before'
  ) {}

  static fromString(str: string) {
    if (!str.startsWith(PREFIX)) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid cursor format',
          hint: 'Cursor must start with "cur_"'
        })
      );
    }

    try {
      let decoded = base62.decode(str.slice(PREFIX.length));
      let [type, id] = JSON.parse(decoded.toString());

      if (type !== 'after' && type !== 'before') {
        throw new Error('Invalid cursor type');
      }

      if (typeof id !== 'string') {
        throw new Error('Invalid cursor id');
      }

      return new Cursor(id, type);
    } catch (e) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid cursor format',
          hint: 'Please provide a valid cursor from another page.'
        })
      );
    }
  }

  static fromId(id: string, type: 'after' | 'before') {
    return new Cursor(id, type);
  }

  toString() {
    return PREFIX + base62.encode(JSON.stringify([this.type, this.id]));
  }
}
