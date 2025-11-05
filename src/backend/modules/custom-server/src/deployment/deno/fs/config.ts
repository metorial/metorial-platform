export let configTs = `import { ProgrammablePromise } from './promise.ts';

export let currentOauth = new ProgrammablePromise();
globalThis.__metorial_setMcpAuth__ = (v: any) => currentOauth.resolve(v);
globalThis.__metorial_getMcpAuth__ = () => currentOauth.promise;

export let currentServer = new ProgrammablePromise();
globalThis.__metorial_setServer__ = (v: any) => currentServer.resolve(v);
globalThis.__metorial_getServer__ = () => currentServer.promise;

export let currentHook = new ProgrammablePromise();
globalThis.__metorial_setCallbackHandler__ = (v: any) => currentHook.resolve(v);
globalThis.__metorial_getCallbackHandler__ = () => currentHook.promise;
`;
