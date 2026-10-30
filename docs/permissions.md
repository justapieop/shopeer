# Required permissions

The permission core is available but is not applied to any application controller.
To opt in later, import `PermissionsModule` in the feature module and decorate a
controller or method:

```ts
@RequirePermissions(Permission.Buy)
```

The decorator attaches metadata and `PermissionsGuard`. Every listed permission
is required. Controller and method requirements are combined, so a method cannot
remove a controller requirement. With no requirements the guard permits access
without authenticating; this decorator does not replace authentication on routes
that only need a logged-in user.

For a protected request the guard reuses the existing bearer-token parsing and
`UserPipe` authentication checks, then calls `AuthorizationUseCase`. The use case
loads the user's current role and uses the domain's `Role.hasPermission()`;
`Super` grants every permission. Permissions are read from the database on each
request. Missing roles and insufficient permissions produce HTTP 403. Invalid
authentication produces HTTP 401; suspended users receive HTTP 403 even with
`Super`. Database failures propagate as server errors.

Resource ownership checks remain in the existing use cases. Granting a permission
does not grant access to another user's resources automatically.
