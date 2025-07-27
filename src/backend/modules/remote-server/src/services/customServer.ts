import { Service } from '@metorial/service';

let include = {};

class RemoteServerRemoteServiceImpl {}

export let remoteServerRemoteService = Service.create(
  'remoteServerRemote',
  () => new RemoteServerRemoteServiceImpl()
).build();
