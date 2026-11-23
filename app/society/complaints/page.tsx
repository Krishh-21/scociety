import { notFound, redirect } from "next/navigation";
import { AppHeader, Phone } from "@/components/ui";
import { formatDate } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUS, listComplaints } from "@/lib/society-complaints";
import { ReportComplaintForm, UpdateComplaintForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.user.role === "guard") redirect("/society/visitors");
  if (me.user.role !== "resident" && me.user.role !== "secretary") notFound();
  if (!me.residency) redirect("/onboarding");
  if (me.residency.status !== "verified") notFound();

  const committee = me.user.role === "secretary";
  const tickets = listComplaints(me);
  return (
    <Phone>
      <AppHeader title="Complaints" subtitle={me.residency.societyName} back={{ href: "/society" }} />
      <div className="flex flex-col gap-4 px-4 py-4">
        <section className="card p-4">
          <details open={!committee && tickets.length === 0}>
            <summary className="font-extrabold cursor-pointer">Report a building issue</summary>
            <p className="mt-2 text-sm text-ink-500">Your society committee can see the details and assign someone to help.</p>
            <ReportComplaintForm categories={COMPLAINT_CATEGORIES} />
          </details>
        </section>

        <section aria-labelledby="complaint-list" className="grid gap-2">
          <h2 id="complaint-list" className="font-extrabold">{committee ? "Society queue" : "My complaints"}</h2>
          {tickets.length === 0 && <p className="card p-4 text-sm text-ink-500">No complaints have been reported here.</p>}
          {tickets.map((ticket) => (
            <article key={ticket.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] text-ink-500">{ticket.category} · {formatDate(ticket.createdAt)}</p>
                  <h3 className="font-extrabold">{ticket.title}</h3>
                </div>
                <span className={`pill ${ticket.status === "resolved" ? "bg-save-50 text-save-700" : "bg-brand-50 text-brand-700"}`}>
                  {COMPLAINT_STATUS[ticket.status]}
                </span>
              </div>
              {committee && <p className="mt-1 text-[13px] text-ink-500">{ticket.resident} · {ticket.flat}</p>}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-700">{ticket.detail}</p>
              {ticket.assignee && <p className="mt-2 text-sm font-bold">Assigned to {ticket.assignee}</p>}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-bold text-brand-700">Status history</summary>
                <ol className="mt-2 grid gap-2 border-l border-line pl-3">
                  {ticket.history.map((event) => (
                    <li key={event.id}>
                      <p className="font-bold">{COMPLAINT_STATUS[event.status]} <time className="font-normal text-ink-500" dateTime={event.createdAt}>· {formatDate(event.createdAt)}</time></p>
                      {event.note && <p className="whitespace-pre-wrap break-words text-ink-700">{event.note}</p>}
                    </li>
                  ))}
                </ol>
              </details>
              {committee && ticket.status !== "resolved" && <UpdateComplaintForm key={ticket.status} id={ticket.id} current={ticket.status} />}
            </article>
          ))}
        </section>
      </div>
    </Phone>
  );
}
