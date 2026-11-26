import { authRedirect } from "@/lib/account-link";
import { clearEmailSignIn } from "@/lib/email-auth";
import { googleAuthConfig, startGoogleSignIn } from "@/lib/google-auth";
import { getMe } from "@/lib/session";

export async function GET(request: Request) {
  const config = googleAuthConfig();
  if (!config) return authRedirect(new URL("/login", request.url));
  try {
    if (await getMe()) return authRedirect(new URL("/", config.origin));
    await clearEmailSignIn().catch(() => {});
    const target = await startGoogleSignIn(config);
    if (target) return authRedirect(target);
  } catch (error) {
    console.error("Google sign-in could not start", error instanceof Error ? error.name : "UnknownError");
  }
  return authRedirect(new URL("/login?google=failed", config.origin));
}
