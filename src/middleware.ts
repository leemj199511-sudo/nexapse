import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth(() => {
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|api/cron|api/onboarding|_next/static|_next/image|favicon.ico|login).*)"],
};
