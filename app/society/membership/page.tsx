import { notFound, redirect } from "next/navigation";
import { AppHeader, Phone, TabBar } from "@/components/ui";
import { isDemoMode } from "@/lib/auth-mode";
import { formatDate } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { listMembershipRequests, listVerifiedResidents } from "@/lib/society-membership";
import ReviewForm from "./ReviewForm";
import RevokeForm from "./RevokeForm";

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.user.role !== "secretary") notFound();
  if (me.residency?.status !== "verified") redirect("/onboarding");
  const [requests, residents] = await Promise.all([
    listMembershipRequests(me), isDemoMode() ? [] : listVerifiedResidents(me),
  ]);

  return (
    <Phone>
      <AppHeader title="Flat requests" subtitle={me.residency.societyName} back={{ href: "/society", label: "Society" }} />
      <div className="flex-1 px-4 py-4 grid content-start gap-3">
        {requests.length > 0 ? (
          <>
            <p className="text-sm text-ink-700">Check each request against your society’s records. Approval gives the applicant access to private society tools.</p>
            <ul aria-label="Pending flat requests" className="grid gap-3">
              {requests.map((request) => (
                <li key={request.id} className="card p-4">
                  <h2 className="font-extrabold">{request.name} · Flat {request.flat}</h2>
                  <p className="mt-1 text-sm text-ink-500"><span className="capitalize">{request.type}</span> · {request.phone}</p>
                  <p className="mt-1 text-xs text-ink-500">Requested <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time></p>
                  <ReviewForm requestId={request.id} />
                </li>
              ))}
            </ul>
          </>
        ) : <p className="card p-4 text-sm text-ink-500">No flat requests are waiting for review.</p>}
        {residents.length > 0 && (
          <details className="card p-4">
            <summary className="cursor-pointer font-extrabold">Manage verified residents</summary>
            <ul aria-label="Verified residents" className="mt-3 grid gap-3">
              {residents.map((resident) => (
                <li key={resident.id} className="border-t border-line pt-3">
                  <p className="font-bold">{resident.name} · Flat {resident.flat}</p>
                  <p className="text-sm text-ink-500">{resident.phone}</p>
                  <RevokeForm residencyId={resident.id} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <TabBar active="society" mobile={false} />
    </Phone>
  );
}
