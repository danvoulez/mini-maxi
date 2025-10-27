// RBAC for Memory System (EP2-Seguranca)
export type Role = "admin" | "user" | "agent" | "system";
export type Permission =
  | "memory:read"
  | "memory:write"
  | "memory:promote"
  | "memory:delete"
  | "memory:admin";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "memory:read",
    "memory:write",
    "memory:promote",
    "memory:delete",
    "memory:admin",
  ],
  user: ["memory:read", "memory:write"],
  agent: ["memory:read", "memory:write", "memory:promote"],
  system: [
    "memory:read",
    "memory:write",
    "memory:promote",
    "memory:delete",
    "memory:admin",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canPromote(role: Role): boolean {
  return (
    hasPermission(role, "memory:promote") || hasPermission(role, "memory:admin")
  );
}

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
