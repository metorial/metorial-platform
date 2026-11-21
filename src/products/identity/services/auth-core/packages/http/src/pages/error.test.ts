import { describe, expect, it } from 'vitest';
import { errorHtml } from './error';

describe('SSO error page', () => {
  it('renders only the public error copy', () => {
    let error = {
      title: 'Unable to Authenticate',
      message: 'An error occurred during authentication.',
      details: 'Prisma connection error: internal-db.example.com'
    };

    let html = errorHtml(error);

    expect(html).toContain(error.title);
    expect(html).toContain(error.message);
    expect(html).not.toContain(error.details);
  });
});
