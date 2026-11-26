import { authRedirect } from "@/lib/account-link";
import { clearEmailSignIn } from "@/lib/email-auth";
import {
  beginGoogleLink, clearGoogleSignIn, exchangeGoogleCode, findGoogleUser, googleAuthConfig,
} from "@/lib/google-auth";
import { createSession, getMe, signInDestination } from "@/lib/session";

export async function GET(request: Request) {
  const config = googleAuthConfig();
  if (!config) return authRedirect(new URL("/login", request.url));
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  try {
    if (await getMe()) {
      await clearGoogleSignIn();
      return authRedirect(new URL("/", config.origin));
    }
    if (params.has("error") || !code) {
      await clearGoogleSignIn();
      return authRedirect(new URL(params.get("error") === "access_denied" ? "/login" : "/login?google=failed", config.origin));
    }
    const identity = await exchangeGoogleCode(config, code);
    if (identity) {
      await clearEmailSignIn().catch(() => {});
      const user = await findGoogleUser(identity.subject);
      if (!user) {
        await beginGoogleLink(identity);
        return authRedirect(new URL("/login", config.origin));
      }
      const destination = await signInDestination(user);
      if (destination) {
        await createSession(user.id);
        return authRedirect(new URL(destination, config.origin));
      }
      return authRedirect(new URL("/login?google=inactive", config.origin));
    }
  } catch (error) {
    console.error("Google sign-in could not complete", error instanceof Error ? error.name : "UnknownError");
  }
  return authRedirect(new URL("/login?google=failed", config.origin));
}
