import { InferSchemaType } from 'mongoose';
import { ID } from '../id';
import { client } from './client';

let TenantSchema = new client.Schema({
  _id: {
    type: String,
    required: true,
    default: () => ID.generateIdSync('tenant')
  },
  status: {
    type: String,
    enum: ['pending', 'completed'] as const,
    default: 'pending',
    required: true
  },

  clientId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  metadata: { type: Object, required: false },
  externalId: { type: String, required: false, unique: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
  updatedAt: { type: Date, required: true, default: () => new Date() }
});
export let Tenant = client.model('Tenant', TenantSchema);
export type Tenant = InferSchemaType<typeof TenantSchema>;

let ConnectionSchema = new client.Schema({
  _id: {
    type: String,
    required: true,
    default: () => ID.generateIdSync('connection')
  },
  tenantId: {
    type: String,
    ref: 'Tenant',
    required: true
  },

  internalClientId: { type: String, required: true },
  internalClientSecret: { type: String, required: true },

  providerType: {
    type: String,
    enum: ['saml', 'oidc'] as const,
    required: true
  },
  providerName: { type: String, required: false },

  name: { type: String, required: true },
  metadata: { type: Object, required: false },

  createdAt: { type: Date, required: true, default: () => new Date() },
  updatedAt: { type: Date, required: true, default: () => new Date() }
});
export let Connection = client.model('Connection', ConnectionSchema);
export type Connection = InferSchemaType<typeof ConnectionSchema>;

let ConnectionSetupSchema = new client.Schema({
  _id: {
    type: String,
    required: true,
    default: () => ID.generateIdSync('setup')
  },

  status: {
    type: String,
    enum: ['pending', 'completed'] as const,
    default: 'pending',
    required: true
  },

  tenantId: {
    type: String,
    ref: 'Tenant',
    required: true
  },
  connectionId: {
    type: String,
    ref: 'Connection',
    required: false
  },

  clientSecret: { type: String, required: true },

  redirectUri: { type: String, required: true },

  createdAt: { type: Date, required: true, default: () => new Date() },
  updatedAt: { type: Date, required: true, default: () => new Date() }
});
export let ConnectionSetup = client.model('ConnectionSetup', ConnectionSetupSchema);
export type ConnectionSetup = InferSchemaType<typeof ConnectionSetupSchema>;

let UserProfileSchema = new client.Schema({
  _id: {
    type: String,
    required: true,
    default: () => ID.generateIdSync('userProfile')
  },
  tenantId: {
    type: String,
    ref: 'Tenant',
    required: true
  },

  externalId: { type: String, required: true, index: true },
  connectionId: {
    type: String,
    ref: 'Connection',
    required: true
  },

  displayName: { type: String, required: false },
  emails: [{ type: String, required: false }],

  metadata: { type: Object, required: false },

  createdAt: { type: Date, required: true, default: () => new Date() },
  updatedAt: { type: Date, required: true, default: () => new Date() }
});
export let UserProfile = client.model('UserProfile', UserProfileSchema);
export type UserProfile = InferSchemaType<typeof UserProfileSchema>;

let UserSchema = new client.Schema({
  _id: {
    type: String,
    required: true,
    default: () => ID.generateIdSync('user')
  },
  tenantId: {
    type: String,
    ref: 'Tenant',
    required: true
  },

  userProfileId: {
    type: String,
    ref: 'UserProfile',
    required: true
  },

  createdAt: { type: Date, required: true, default: () => new Date() },
  updatedAt: { type: Date, required: true, default: () => new Date() }
});
export let User = client.model('User', UserSchema);
