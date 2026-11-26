import { authRedirect } from "@/lib/account-link";
import { clearEmailSignIn } from "@/lib/email-auth";

export async function GET(request: Request) {
  await clearEmailSignIn().catch(() => {});
  return authRedirect(new URL("/login", request.url));
}
