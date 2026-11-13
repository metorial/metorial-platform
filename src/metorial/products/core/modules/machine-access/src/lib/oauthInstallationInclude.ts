import { machineAccessInclude } from '../services/machineAccessAuth';

// Lives outside the services because they import each other, which can leave this undefined at load.
export let installationInclude = {
  organization: true,
  appActor: true,
  oauthApplication: {
    include: {
      organization: true
    }
  },
  serverSideMachineAccess: {
    include: machineAccessInclude
  }
} as const;
