import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthContext } from "@/lib/server/auth-guard";
import { getBootstrap } from "@/lib/server/houra-repo";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthContext();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.role !== "student" || !user.isApproved) {
    redirect("/waitlist");
  }

  const bootstrap = await getBootstrap(user);

  return <AppShell initialState={bootstrap.state}>{children}</AppShell>;
}
