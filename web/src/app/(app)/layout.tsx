import { redirect } from "next/navigation";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await clerkAuthService.getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.role !== "student" || !user.isApproved) {
    redirect("/waitlist");
  }

  return <AppShell>{children}</AppShell>;
}
