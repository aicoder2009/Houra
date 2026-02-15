import { auth } from "@clerk/nextjs/server";
import type { AuthService } from "@/lib/services/interfaces";
import { resolveStudentClaims } from "@/lib/clerk/claims";

export const clerkAuthService: AuthService = {
  async getCurrentUser() {
    const session = await auth();

    if (!session.userId) {
      return null;
    }

    const publicMetadata = (session.sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>;
    const claims = resolveStudentClaims(publicMetadata);

    return {
      clerkUserId: session.userId,
      isApproved: claims.isApproved,
      role: claims.role,
    };
  },
};
