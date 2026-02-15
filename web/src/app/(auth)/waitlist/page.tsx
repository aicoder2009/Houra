import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveStudentClaims } from "@/lib/clerk/claims";

export default async function WaitlistPage() {
  const session = await auth();

  if (!session.userId) {
    redirect("/sign-in");
  }

  const metadata = (session.sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>;
  const { isApproved } = resolveStudentClaims(metadata);

  if (isApproved) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-16">
      <Card className="glass-panel w-full border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Access Pending Approval</CardTitle>
          <CardDescription>
            Your account is on the Houra waitlist. An admin must set <code>publicMetadata.isApproved=true</code>{" "}
            in Clerk before app access is unlocked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-muted-foreground">
          <p>This MVP is student-only. If your role metadata is not set to student, access remains blocked.</p>
          <div className="flex items-center justify-between rounded-md border border-border/70 bg-surface/80 p-3">
            <span>Signed in as: {session.userId}</span>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
