import { installOfflineEnv } from './env';
import { installNetworkGuard } from './guard';
import { installModuleStubs } from './modules';
import { installPrismaStub } from './prisma';
import { installRpcStub } from './rpc';

export let installOfflineMode = () => {
  installOfflineEnv();
  installNetworkGuard();
  installPrismaStub();
  installRpcStub();
  installModuleStubs();
};
