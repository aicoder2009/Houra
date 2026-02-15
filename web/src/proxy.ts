import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveStudentClaims } from "@/lib/clerk/claims";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/waitlist(.*)",
  "/",
  "/api/agent/runs/scheduled",
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session.userId) {
    return session.redirectToSignIn({ returnBackUrl: req.url });
  }

  const metadata = (session.sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>;
  const { isApproved, role } = resolveStudentClaims(metadata);

  if (role !== "student") {
    return NextResponse.redirect(new URL("/waitlist?reason=student-only", req.url));
  }

  if (!isApproved && !pathname.startsWith("/waitlist")) {
    return NextResponse.redirect(new URL("/waitlist", req.url));
  }

  if (isApproved && pathname.startsWith("/waitlist")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
