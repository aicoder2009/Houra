import type { AuthService } from "@/lib/services/interfaces";
import { getAuthContext } from "@/lib/server/auth-guard";

export const clerkAuthService: AuthService = {
  async getCurrentUser() {
    return getAuthContext();
  },
};
