# Audit scope

Audit scopes identify the resource tenant, resource group, and actor associated with an
audit event. The `ensure*AuditScope` helpers perform resource resolution and provisioning
only when called.

REST handlers should preserve an audit scope supplied by authentication and lazily fall
back to the helper matching the operation:

```ts
let auditScope =
  ctx.auditScope ??
  (await ensureOrganizationMemberAuditScope({
    organization: ctx.organization,
    member: ctx.member,
    context: ctx.context
  }));
```

Use the generic organization or project helper for machine and system actors, and the
actor-specific helper for organization actors. Authentication and middleware must not
call these helpers eagerly.
