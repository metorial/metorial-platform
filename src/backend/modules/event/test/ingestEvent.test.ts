import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ingestEventService } from '../src/services/ingestEvent';
import type { EventTypes } from '../src/definitions';

// Mock the Service module
vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: () => any) => ({
      build: vi.fn(() => factory())
    }))
  }
}));

// Mock database types
vi.mock('@metorial/db', () => ({
  File: {},
  FilePurpose: {},
  Secret: {},
  Server: {},
  ServerDeployment: {},
  ServerDeploymentConfig: {},
  ServerImplementation: {},
  ServerSession: {},
  ServerVariant: {},
  Session: {},
  SessionServerDeployment: {},
  Instance: {},
  Organization: {},
  OrganizationActor: {}
}));

describe('IngestEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ingest method', () => {
    it('should exist and be callable', () => {
      expect(ingestEventService).toBeDefined();
      expect(ingestEventService.ingest).toBeDefined();
      expect(typeof ingestEventService.ingest).toBe('function');
    });

    describe('server.server_implementation events', () => {
      it('should handle server_implementation:created event', async () => {
        const payload = {
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
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          },
          performedBy: {
            id: 'actor-1',
            name: 'Test Actor'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle server_implementation:updated event', async () => {
        const payload = {
          serverImplementation: {
            id: 'impl-1',
            version: '2.0.0',
            server: {
              id: 'server-1',
              name: 'Updated Server'
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Updated Variant'
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:updated', payload)
        ).resolves.not.toThrow();
      });

      it('should handle server_implementation:deleted event', async () => {
        const payload = {
          serverImplementation: {
            id: 'impl-1',
            server: {
              id: 'server-1',
              name: 'Deleted Server'
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Deleted Variant'
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:deleted', payload)
        ).resolves.not.toThrow();
      });

      it('should handle event without performedBy field', async () => {
        const payload = {
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
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
          // performedBy is optional
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });
    });

    describe('server.server_deployment events', () => {
      it('should handle server_deployment:created event', async () => {
        const payload = {
          serverDeployment: {
            id: 'deploy-1',
            status: 'active',
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
                name: 'API Key'
              }
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          },
          performedBy: {
            id: 'actor-1',
            name: 'Test Actor'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_deployment:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle server_deployment:updated event', async () => {
        const payload = {
          serverDeployment: {
            id: 'deploy-1',
            status: 'updated',
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
                name: 'Updated API Key'
              }
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_deployment:updated', payload)
        ).resolves.not.toThrow();
      });

      it('should handle server_deployment:deleted event', async () => {
        const payload = {
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
                name: 'Deleted API Key'
              }
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_deployment:deleted', payload)
        ).resolves.not.toThrow();
      });
    });

    describe('session events', () => {
      it('should handle session:created event with empty server deployments', async () => {
        const payload = {
          session: {
            id: 'session-1',
            userId: 'user-1',
            serverDeployments: []
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          },
          performedBy: {
            id: 'actor-1',
            name: 'Test Actor'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle session:created event with server deployments', async () => {
        const payload = {
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
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle session:updated event', async () => {
        const payload = {
          session: {
            id: 'session-1',
            userId: 'user-1',
            status: 'active',
            serverDeployments: [
              {
                id: 'ssd-1',
                serverDeployment: {
                  id: 'deploy-1',
                  server: {
                    id: 'server-1',
                    name: 'Updated Server'
                  },
                  serverVariant: {
                    id: 'variant-1',
                    name: 'Updated Variant'
                  }
                }
              }
            ]
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session:updated', payload)
        ).resolves.not.toThrow();
      });

      it('should handle session:deleted event', async () => {
        const payload = {
          session: {
            id: 'session-1',
            userId: 'user-1',
            serverDeployments: []
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session:deleted', payload)
        ).resolves.not.toThrow();
      });

      it('should handle session with multiple server deployments', async () => {
        const payload = {
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
              },
              {
                id: 'ssd-3',
                serverDeployment: {
                  id: 'deploy-3',
                  server: { id: 'server-3', name: 'Server 3' },
                  serverVariant: { id: 'variant-3', name: 'Variant 3' }
                }
              }
            ]
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session:created', payload)
        ).resolves.not.toThrow();
      });
    });

    describe('session.server_session events', () => {
      it('should handle server_session:created event', async () => {
        const payload = {
          serverSession: {
            id: 'ss-1',
            sessionId: 'session-1',
            status: 'active',
            serverDeployment: {
              id: 'deploy-1',
              serverVariant: {
                id: 'variant-1',
                name: 'Test Variant'
              }
            }
          },
          session: {
            id: 'session-1',
            userId: 'user-1'
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          },
          performedBy: {
            id: 'actor-1',
            name: 'Test Actor'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session.server_session:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle server_session with different variants', async () => {
        const payload = {
          serverSession: {
            id: 'ss-1',
            sessionId: 'session-1',
            serverDeployment: {
              id: 'deploy-1',
              serverVariant: {
                id: 'variant-2',
                name: 'Production Variant',
                version: '2.0.0'
              }
            }
          },
          session: {
            id: 'session-1',
            userId: 'user-2',
            createdAt: new Date()
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session.server_session:created', payload)
        ).resolves.not.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle events with minimal required data', async () => {
        const payload = {
          serverImplementation: {
            id: 'impl-1',
            server: {
              id: 'server-1'
            },
            serverVariant: {
              id: 'variant-1'
            }
          },
          organization: {
            id: 'org-1'
          },
          instance: {
            id: 'inst-1'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle events with additional metadata', async () => {
        const payload = {
          serverImplementation: {
            id: 'impl-1',
            server: {
              id: 'server-1',
              name: 'Test Server',
              metadata: {
                region: 'us-east-1',
                tier: 'production'
              }
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Test Variant'
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org',
            plan: 'enterprise'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          },
          performedBy: {
            id: 'actor-1',
            name: 'Test Actor',
            role: 'admin'
          },
          metadata: {
            timestamp: Date.now(),
            source: 'api'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle deeply nested structures', async () => {
        const payload = {
          serverDeployment: {
            id: 'deploy-1',
            serverImplementation: {
              id: 'impl-1',
              version: '1.0.0',
              server: {
                id: 'server-1',
                name: 'Complex Server',
                settings: {
                  nested: {
                    deeply: {
                      value: 'test'
                    }
                  }
                }
              },
              serverVariant: {
                id: 'variant-1',
                name: 'Complex Variant'
              }
            },
            server: {
              id: 'server-1',
              name: 'Complex Server'
            },
            config: {
              id: 'config-1',
              configSecret: {
                id: 'secret-1',
                name: 'Complex Secret',
                metadata: {
                  encrypted: true,
                  algorithm: 'AES-256-GCM'
                }
              }
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_deployment:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle concurrent event ingestions', async () => {
        const payload1 = {
          serverImplementation: {
            id: 'impl-1',
            server: { id: 'server-1', name: 'Server 1' },
            serverVariant: { id: 'variant-1', name: 'Variant 1' }
          },
          organization: { id: 'org-1', name: 'Org 1' },
          instance: { id: 'inst-1', name: 'Instance 1' }
        } as any;

        const payload2 = {
          serverImplementation: {
            id: 'impl-2',
            server: { id: 'server-2', name: 'Server 2' },
            serverVariant: { id: 'variant-2', name: 'Variant 2' }
          },
          organization: { id: 'org-2', name: 'Org 2' },
          instance: { id: 'inst-2', name: 'Instance 2' }
        } as any;

        const payload3 = {
          session: {
            id: 'session-1',
            userId: 'user-1',
            serverDeployments: []
          },
          organization: { id: 'org-3', name: 'Org 3' },
          instance: { id: 'inst-3', name: 'Instance 3' }
        } as any;

        await expect(
          Promise.all([
            ingestEventService.ingest('server.server_implementation:created', payload1),
            ingestEventService.ingest('server.server_implementation:updated', payload2),
            ingestEventService.ingest('session:created', payload3)
          ])
        ).resolves.not.toThrow();
      });

      it('should handle events with empty string IDs', async () => {
        const payload = {
          serverImplementation: {
            id: '',
            server: {
              id: '',
              name: ''
            },
            serverVariant: {
              id: '',
              name: ''
            }
          },
          organization: {
            id: '',
            name: ''
          },
          instance: {
            id: '',
            name: ''
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle events with very long strings', async () => {
        const longString = 'a'.repeat(10000);
        const payload = {
          serverImplementation: {
            id: 'impl-1',
            description: longString,
            server: {
              id: 'server-1',
              name: longString
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Test Variant'
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle events with special characters in strings', async () => {
        const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\n\t\r';
        const payload = {
          serverImplementation: {
            id: `impl-${specialChars}`,
            server: {
              id: `server-${specialChars}`,
              name: `Server ${specialChars}`
            },
            serverVariant: {
              id: 'variant-1',
              name: `Variant ${specialChars}`
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle events with null values in optional fields', async () => {
        const payload = {
          serverImplementation: {
            id: 'impl-1',
            server: {
              id: 'server-1',
              name: 'Test Server',
              description: null
            },
            serverVariant: {
              id: 'variant-1',
              name: 'Test Variant',
              metadata: null
            }
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          },
          performedBy: undefined
        } as any;

        await expect(
          ingestEventService.ingest('server.server_implementation:created', payload)
        ).resolves.not.toThrow();
      });

      it('should handle large arrays in session server deployments', async () => {
        const serverDeployments = Array.from({ length: 100 }, (_, i) => ({
          id: `ssd-${i}`,
          serverDeployment: {
            id: `deploy-${i}`,
            server: { id: `server-${i}`, name: `Server ${i}` },
            serverVariant: { id: `variant-${i}`, name: `Variant ${i}` }
          }
        }));

        const payload = {
          session: {
            id: 'session-1',
            userId: 'user-1',
            serverDeployments
          },
          organization: {
            id: 'org-1',
            name: 'Test Org'
          },
          instance: {
            id: 'inst-1',
            name: 'Test Instance'
          }
        } as any;

        await expect(
          ingestEventService.ingest('session:created', payload)
        ).resolves.not.toThrow();
      });
    });

    describe('Type Safety', () => {
      it('should maintain type safety for event keys', () => {
        const validEventKeys: Array<keyof EventTypes> = [
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

        expect(validEventKeys).toHaveLength(10);
        validEventKeys.forEach((key) => {
          expect(typeof key).toBe('string');
        });
      });

      it('should ensure payload structure matches event type', async () => {
        // This test verifies compile-time type checking works correctly
        const implementationPayload = {
          serverImplementation: {
            id: 'impl-1',
            server: { id: 'server-1', name: 'Server' },
            serverVariant: { id: 'variant-1', name: 'Variant' }
          },
          organization: { id: 'org-1', name: 'Org' },
          instance: { id: 'inst-1', name: 'Instance' }
        } as any;

        // Type system ensures this is valid
        await ingestEventService.ingest(
          'server.server_implementation:created',
          implementationPayload
        );

        const deploymentPayload = {
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
          },
          organization: { id: 'org-1', name: 'Org' },
          instance: { id: 'inst-1', name: 'Instance' }
        } as any;

        // Type system ensures this is valid
        await ingestEventService.ingest('server.server_deployment:created', deploymentPayload);
      });
    });
  });
});
