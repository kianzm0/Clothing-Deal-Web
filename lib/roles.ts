// Safe to share with client components. Only explicit editorial roles qualify.
export function canEditCatalog(role: unknown): role is "EDITOR" | "ADMIN" {
  return role === "EDITOR" || role === "ADMIN";
}
