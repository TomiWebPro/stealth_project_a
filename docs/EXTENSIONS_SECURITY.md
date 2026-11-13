# Extensions & Security

## 1. Extension platform

Core app + optional extensions: capabilities, UI, provider connectors, local
runtimes.

Manifest includes ID, name, version, publisher, type, supported app versions,
permissions, capabilities, provider/runtime requirements, UI contributions,
dependencies.

Discovery: official, third-party, private studio registries, manual packages,
org-managed. Safe install/remove/update with compatibility checks.

## 2. Permissions & trust

Least privilege; permission-based extensions. Extension signing, verification,
revocation. Clear active workspace identity. AuthZ for projects/members.

## 3. Execution isolation

Controlled tool execution via backend services. No unrestricted native code by
default extensions. Sandboxed/isolated execution for untrusted extensions.
Native extensions privileged. Filesystem boundaries in the desktop client.

## 4. Data & job safety

Data isolation between projects/users/studios. Secure credential storage per
backend. Soft delete/recovery and dependency warnings on assets. Idempotent
job cancellation/retry.
