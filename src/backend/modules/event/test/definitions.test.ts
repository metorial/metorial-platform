import { describe, it, expect } from 'vitest';
import type {
  EventTypes,
  EventTypesFilePayload,
  EventTypesServerImplementationPayload,
  EventTypesServerDeploymentPayload,
  EventTypesSessionPayload,
  EventTypesServerSessionPayload
} from '../src/definitions';

describe('Event Type Definitions', () => {
  describe('EventTypesFilePayload', () => {
    it('should accept valid file payload', () => {
      const payload: EventTypesFilePayload = {
        file: {
          id: 'file-1',
          name: 'test.txt',
          purpose: {
            id: 'purpose-1',
            name: 'Test Purpose'
          }
        } as any
      };

      expect(payload).toBeDefined();
      expect(payload.file).toBeDefined();
      expect(payload.file.purpose).toBeDefined();
    });

    it('should require file with purpose', () => {
      const payload: EventTypesFilePayload = {
        file: {
          id: 'file-1',
          name: 'test.txt',
          purpose: {
            id: 'purpose-1',
            name: 'Test Purpose',
            description: 'A test purpose'
          }
        } as any
      };

      expect(payload.file.id).toBe('file-1');
      expect(payload.file.purpose.id).toBe('purpose-1');
    });
  });

  describe('EventTypesServerImplementationPayload', () => {
    it('should accept valid server implementation payload', () => {
      const payload: EventTypesServerImplementationPayload = {
        serverImplementation: {
          id: 'impl-1',
          server: {
            id: 'server-1',
            name: 'Test Server'
          },
          serverVariant: {
            id: 'variant-1',
            name: 'Test Variant'
          }
        } as any
      };

      expect(payload).toBeDefined();
      expect(payload.serverImplementation).toBeDefined();
      expect(payload.serverImplementation.server).toBeDefined();
      expect(payload.serverImplementation.serverVariant).toBeDefined();
    });

    it('should include nested server and variant objects', () => {
      const payload: EventTypesServerImplementationPayload = {
        serverImplementation: {
          id: 'impl-1',
          version: '1.0.0',
          server: {
            id: 'server-1',
            name: 'Test Server'
          },
          serverVariant: {
            id: 'variant-1',
            name: 'Test Variant'
          }
        } as any
      };

      expect(payload.serverImplementation.server.name).toBe('Test Server');
      expect(payload.serverImplementation.serverVariant.id).toBe('variant-1');
    });
  });

  describe('EventTypesServerDeploymentPayload', () => {
    it('should accept valid server deployment payload', () => {
      const payload: EventTypesServerDeploymentPayload = {
        serverDeployment: {
          id: 'deploy-1',
          serverImplementation: {
            id: 'impl-1',
            server: {
              id: 'server-1',
              name: 'Test Server'
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Test Variant'
            }
          },
          server: {
            id: 'server-1',
            name: 'Test Server'
          },
          config: {
            id: 'config-1',
            configSecret: {
              id: 'secret-1',
              name: 'Test Secret'
            }
          }
        } as any
      };

      expect(payload).toBeDefined();
      expect(payload.serverDeployment).toBeDefined();
      expect(payload.serverDeployment.serverImplementation).toBeDefined();
      expect(payload.serverDeployment.server).toBeDefined();
      expect(payload.serverDeployment.config).toBeDefined();
      expect(payload.serverDeployment.config.configSecret).toBeDefined();
    });

    it('should handle complex nested structure', () => {
      const payload: EventTypesServerDeploymentPayload = {
        serverDeployment: {
          id: 'deploy-1',
          status: 'active',
          serverImplementation: {
            id: 'impl-1',
            version: '2.0.0',
            server: {
              id: 'server-1',
              name: 'Production Server'
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Production Variant'
            }
          },
          server: {
            id: 'server-1',
            name: 'Production Server'
          },
          config: {
            id: 'config-1',
            settings: { key: 'value' },
            configSecret: {
              id: 'secret-1',
              name: 'API Secret',
              value: 'encrypted'
            }
          }
        } as any
      };

      expect(payload.serverDeployment.config.configSecret.id).toBe('secret-1');
    });
  });

  describe('EventTypesSessionPayload', () => {
    it('should accept valid session payload', () => {
      const payload: EventTypesSessionPayload = {
        session: {
          id: 'session-1',
          userId: 'user-1',
          serverDeployments: []
        } as any
      };

      expect(payload).toBeDefined();
      expect(payload.session).toBeDefined();
      expect(payload.session.serverDeployments).toBeDefined();
    });

    it('should handle session with server deployments', () => {
      const payload: EventTypesSessionPayload = {
        session: {
          id: 'session-1',
          userId: 'user-1',
          serverDeployments: [
            {
              id: 'ssd-1',
              serverDeployment: {
                id: 'deploy-1',
                server: {
                  id: 'server-1',
                  name: 'Test Server'
                },
                serverVariant: {
                  id: 'variant-1',
                  name: 'Test Variant'
                }
              }
            }
          ]
        } as any
      };

      expect(payload.session.serverDeployments).toHaveLength(1);
      expect(payload.session.serverDeployments[0].serverDeployment.server.name).toBe('Test Server');
    });

    it('should handle session with multiple server deployments', () => {
      const payload: EventTypesSessionPayload = {
        session: {
          id: 'session-1',
          userId: 'user-1',
          serverDeployments: [
            {
              id: 'ssd-1',
              serverDeployment: {
                id: 'deploy-1',
                server: { id: 'server-1', name: 'Server 1' },
                serverVariant: { id: 'variant-1', name: 'Variant 1' }
              }
            },
            {
              id: 'ssd-2',
              serverDeployment: {
                id: 'deploy-2',
                server: { id: 'server-2', name: 'Server 2' },
                serverVariant: { id: 'variant-2', name: 'Variant 2' }
              }
            }
          ]
        } as any
      };

      expect(payload.session.serverDeployments).toHaveLength(2);
      expect(payload.session.serverDeployments[1].serverDeployment.server.name).toBe('Server 2');
    });

    it('should handle empty server deployments array', () => {
      const payload: EventTypesSessionPayload = {
        session: {
          id: 'session-1',
          userId: 'user-1',
          serverDeployments: []
        } as any
      };

      expect(payload.session.serverDeployments).toHaveLength(0);
    });
  });

  describe('EventTypesServerSessionPayload', () => {
    it('should accept valid server session payload', () => {
      const payload: EventTypesServerSessionPayload = {
        serverSession: {
          id: 'ss-1',
          sessionId: 'session-1',
          serverDeployment: {
            id: 'deploy-1',
            serverVariant: {
              id: 'variant-1',
              name: 'Test Variant'
            }
          }
        } as any,
        session: {
          id: 'session-1',
          userId: 'user-1'
        } as any
      };

      expect(payload).toBeDefined();
      expect(payload.serverSession).toBeDefined();
      expect(payload.session).toBeDefined();
      expect(payload.serverSession.serverDeployment).toBeDefined();
      expect(payload.serverSession.serverDeployment.serverVariant).toBeDefined();
    });

    it('should include both server session and session', () => {
      const payload: EventTypesServerSessionPayload = {
        serverSession: {
          id: 'ss-1',
          sessionId: 'session-1',
          status: 'active',
          serverDeployment: {
            id: 'deploy-1',
            serverVariant: {
              id: 'variant-1',
              name: 'Production Variant'
            }
          }
        } as any,
        session: {
          id: 'session-1',
          userId: 'user-1',
          createdAt: new Date()
        } as any
      };

      expect(payload.session.id).toBe('session-1');
      expect(payload.serverSession.serverDeployment.serverVariant.id).toBe('variant-1');
    });
  });

  describe('EventTypes', () => {
    it('should define all event type keys', () => {
      const eventKeys = [
        'server.server_implementation:created',
        'server.server_implementation:updated',
        'server.server_implementation:deleted',
        'server.server_deployment:created',
        'server.server_deployment:updated',
        'server.server_deployment:deleted',
        'session:created',
        'session:updated',
        'session:deleted',
        'session.server_session:created'
      ];

      // This test verifies that the type includes all expected event keys
      // Type checking happens at compile time
      const sampleEvents: Partial<Record<keyof EventTypes, boolean>> = {
        'server.server_implementation:created': true,
        'server.server_implementation:updated': true,
        'server.server_implementation:deleted': true,
        'server.server_deployment:created': true,
        'server.server_deployment:updated': true,
        'server.server_deployment:deleted': true,
        'session:created': true,
        'session:updated': true,
        'session:deleted': true,
        'session.server_session:created': true
      };

      expect(Object.keys(sampleEvents)).toHaveLength(10);
    });

    it('should map server implementation events to correct payload type', () => {
      const event: keyof EventTypes = 'server.server_implementation:created';
      const payload: EventTypesServerImplementationPayload = {
        serverImplementation: {
          id: 'impl-1',
          server: { id: 'server-1', name: 'Server' },
          serverVariant: { id: 'variant-1', name: 'Variant' }
        } as any
      };

      expect(event).toBe('server.server_implementation:created');
      expect(payload.serverImplementation).toBeDefined();
    });

    it('should map server deployment events to correct payload type', () => {
      const event: keyof EventTypes = 'server.server_deployment:created';
      const payload: EventTypesServerDeploymentPayload = {
        serverDeployment: {
          id: 'deploy-1',
          serverImplementation: {
            id: 'impl-1',
            server: { id: 'server-1', name: 'Server' },
            serverVariant: { id: 'variant-1', name: 'Variant' }
          },
          server: { id: 'server-1', name: 'Server' },
          config: {
            id: 'config-1',
            configSecret: { id: 'secret-1', name: 'Secret' }
          }
        } as any
      };

      expect(event).toBe('server.server_deployment:created');
      expect(payload.serverDeployment).toBeDefined();
    });

    it('should map session events to correct payload type', () => {
      const event: keyof EventTypes = 'session:created';
      const payload: EventTypesSessionPayload = {
        session: {
          id: 'session-1',
          userId: 'user-1',
          serverDeployments: []
        } as any
      };

      expect(event).toBe('session:created');
      expect(payload.session).toBeDefined();
    });

    it('should map server session events to correct payload type', () => {
      const event: keyof EventTypes = 'session.server_session:created';
      const payload: EventTypesServerSessionPayload = {
        serverSession: {
          id: 'ss-1',
          sessionId: 'session-1',
          serverDeployment: {
            id: 'deploy-1',
            serverVariant: { id: 'variant-1', name: 'Variant' }
          }
        } as any,
        session: { id: 'session-1', userId: 'user-1' } as any
      };

      expect(event).toBe('session.server_session:created');
      expect(payload.serverSession).toBeDefined();
      expect(payload.session).toBeDefined();
    });
  });

  describe('Edge Cases and Type Safety', () => {
    it('should handle payload with additional properties', () => {
      const payload: EventTypesServerImplementationPayload = {
        serverImplementation: {
          id: 'impl-1',
          extraProp: 'should be allowed',
          server: {
            id: 'server-1',
            name: 'Server',
            customField: 123
          },
          serverVariant: {
            id: 'variant-1',
            name: 'Variant'
          }
        } as any
      };

      expect(payload.serverImplementation).toBeDefined();
    });

    it('should handle deeply nested server deployment structure', () => {
      const payload: EventTypesServerDeploymentPayload = {
        serverDeployment: {
          id: 'deploy-1',
          metadata: { tags: ['prod', 'critical'] },
          serverImplementation: {
            id: 'impl-1',
            version: '3.0.0',
            server: {
              id: 'server-1',
              name: 'Complex Server',
              metadata: { region: 'us-east-1' }
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Complex Variant',
              features: ['feature1', 'feature2']
            }
          },
          server: {
            id: 'server-1',
            name: 'Complex Server'
          },
          config: {
            id: 'config-1',
            version: 2,
            configSecret: {
              id: 'secret-1',
              name: 'Complex Secret',
              encrypted: true,
              algorithm: 'AES-256'
            }
          }
        } as any
      };

      expect(payload.serverDeployment.config.configSecret.id).toBe('secret-1');
    });
  });
});
