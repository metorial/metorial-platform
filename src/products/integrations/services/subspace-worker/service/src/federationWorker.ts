import { runQueueProcessors } from '@lowerdeck/queue';
import {
  startSubspaceFederationBootJobs,
  subspaceFederationQueueProcessor
} from './federationQueues';

startSubspaceFederationBootJobs();

runQueueProcessors([subspaceFederationQueueProcessor]);
