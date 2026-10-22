/**
 * Role-Based Access Control (RBAC) definitions and permission checkers.
 * Roles: ADMIN, ENGINEER, REVIEWER
 */

export type UserRole = "ADMIN" | "ENGINEER" | "REVIEWER";

export type Permission =
  | "projects:create"
  | "projects:read"
  | "projects:update"
  | "projects:delete"
  | "team:manage"
  | "organization:manage"
  | "qc:execute"
  | "qc:review";

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    "projects:create",
    "projects:read",
    "projects:update",
    "projects:delete",
    "team:manage",
    "organization:manage",
    "qc:execute",
    "qc:review",
  ],
  ENGINEER: [
    "projects:create",
    "projects:read",
    "projects:update",
    "qc:execute",
    "projects:read",
  ],
  REVIEWER: [
    "projects:read",
    "qc:review",
  ],
} as const;

/**
 * Check if a role possesses a specific permission.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}
