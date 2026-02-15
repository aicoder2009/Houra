export function resolveStudentClaims(
  publicMetadata: Record<string, unknown> | null | undefined,
): {
  role: "student" | "unknown";
  isApproved: boolean;
} {
  const rawRole = publicMetadata?.role;
  const role: "student" | "unknown" =
    rawRole === "student" || rawRole === undefined ? "student" : "unknown";

  const rawApproved = publicMetadata?.isApproved;
  const isApproved =
    typeof rawApproved === "boolean"
      ? rawApproved
      : process.env.NODE_ENV !== "production";

  return {
    role,
    isApproved,
  };
}
