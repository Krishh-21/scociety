import { authRedirect } from "@/lib/account-link";
import { clearGoogleSignIn, googleAuthConfig } from "@/lib/google-auth";

export async function GET(request: Request) {
  const config = googleAuthConfig();
  if (!config) return authRedirect(new URL("/login", request.url));
  try {
    await clearGoogleSignIn();
  } catch (error) {
    console.error("Google sign-in cleanup failed", error instanceof Error ? error.name : "UnknownError");
  }
  return authRedirect(new URL("/login", config.origin));
}
