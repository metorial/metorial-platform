// import { Instance, ManagedServerDeploymentInstance, Session } from '@metorial/db';
// import {
//   Implementation,
//   Prompt,
//   ResourceTemplate,
//   ServerCapabilities,
//   Tool
// } from '@modelcontextprotocol/sdk/types';

// export abstract class BaseDeploymentConnection {
//   constructor(
//     private readonly deploymentInstance: ManagedServerDeploymentInstance,
//     private readonly instance: Instance,
//     private readonly session: Session
//   ) {}

//   abstract getCapabilities(): {
//     tools: Tool[];
//     prompts: Prompt[];
//     resourceTemplates: ResourceTemplate[];
//     implementations: Implementation[];
//     serverCapabilities: ServerCapabilities;
//   };

//   abstract close(): Promise<void>;
// }
