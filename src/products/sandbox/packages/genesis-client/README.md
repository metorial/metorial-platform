# @metorial/genesis-client

Typed RPC client for the Genesis sandbox controller's internal API.

**Everything under `src/` is generated.** The source of truth is
`src/sandbox/systems/genesis/clients/internal` in the Metorial enterprise repo. Running
`bun run build` there bundles the client, rewrites its type declarations so they no longer
reference private Genesis packages, and copies the result here.

Do not edit `src/` by hand; change the enterprise client and rebuild, then commit the result in
the `oss` submodule.
