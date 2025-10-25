import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  ensureEmailIdentity: vi.fn()
}));

describe('defaultEmailIdentity', () => {
  let getConfig: any;
  let ensureEmailIdentity: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    getConfig = (await import('@metorial/config')).getConfig;
    ensureEmailIdentity = (await import('@metorial/db')).ensureEmailIdentity;
  });

  it('should create default email identity with config values', async () => {
    getConfig.mockReturnValue({
      email: {
        fromEmail: 'noreply@example.com',
        fromName: 'Example Company'
      }
    });

    let capturedFactory: any;
    ensureEmailIdentity.mockImplementation((factory: any) => {
      capturedFactory = factory;
      return Promise.resolve({
        type: 'email',
        slug: 'default',
        fromEmail: 'noreply@example.com',
        fromName: 'Example Company',
        oid: 1n
      });
    });

    // Import the module to trigger the initialization
    await import('../src/definitions');

    expect(ensureEmailIdentity).toHaveBeenCalled();
    expect(typeof capturedFactory).toBe('function');

    // Test the factory function
    const identity = await capturedFactory();
    expect(identity).toEqual({
      type: 'email',
      slug: 'default',
      fromEmail: 'noreply@example.com',
      fromName: 'Example Company'
    });
  });

  it('should use config values in identity factory', async () => {
    getConfig.mockReturnValue({
      email: {
        fromEmail: 'support@test.com',
        fromName: 'Test Support'
      }
    });

    let capturedFactory: any;
    ensureEmailIdentity.mockImplementation((factory: any) => {
      capturedFactory = factory;
      return Promise.resolve({
        type: 'email',
        slug: 'default',
        fromEmail: 'support@test.com',
        fromName: 'Test Support',
        oid: 2n
      });
    });

    await import('../src/definitions');

    const identity = await capturedFactory();
    expect(identity.fromEmail).toBe('support@test.com');
    expect(identity.fromName).toBe('Test Support');
  });

  it('should always use type "email" and slug "default"', async () => {
    getConfig.mockReturnValue({
      email: {
        fromEmail: 'any@example.com',
        fromName: 'Any Name'
      }
    });

    let capturedFactory: any;
    ensureEmailIdentity.mockImplementation((factory: any) => {
      capturedFactory = factory;
      return Promise.resolve({});
    });

    await import('../src/definitions');

    const identity = await capturedFactory();
    expect(identity.type).toBe('email');
    expect(identity.slug).toBe('default');
  });

  it('should handle special characters in email config', async () => {
    getConfig.mockReturnValue({
      email: {
        fromEmail: 'no-reply+test@example.com',
        fromName: 'Test "Company" & Co.'
      }
    });

    let capturedFactory: any;
    ensureEmailIdentity.mockImplementation((factory: any) => {
      capturedFactory = factory;
      return Promise.resolve({});
    });

    await import('../src/definitions');

    const identity = await capturedFactory();
    expect(identity.fromEmail).toBe('no-reply+test@example.com');
    expect(identity.fromName).toBe('Test "Company" & Co.');
  });

  it('should handle unicode characters in fromName', async () => {
    getConfig.mockReturnValue({
      email: {
        fromEmail: 'hello@example.com',
        fromName: '世界 Company 🌍'
      }
    });

    let capturedFactory: any;
    ensureEmailIdentity.mockImplementation((factory: any) => {
      capturedFactory = factory;
      return Promise.resolve({});
    });

    await import('../src/definitions');

    const identity = await capturedFactory();
    expect(identity.fromName).toBe('世界 Company 🌍');
  });
});
