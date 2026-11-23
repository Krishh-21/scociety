import type { JobStatus } from "@/lib/types";

export default function ServiceVisit({
  job,
  queue,
}: {
  job: { technician: string; status: JobStatus; startOtp: string; endOtp: string };
  queue: { ahead: number; etaMin: number } | null;
}) {
  if (job.status === "completed") return null;

  return (
    <div className="card p-3 bg-surface text-[13px] text-ink-700">
      <p className="font-bold">Technician {job.technician}</p>
      {job.status === "scheduled" && <p>Your visit is scheduled. Check here for updates.</p>}
      {queue && queue.ahead > 0 && (
        <p>{queue.ahead} {queue.ahead === 1 ? "flat" : "flats"} ahead · about {queue.etaMin} min</p>
      )}
      {job.status === "en_route" && (
        <p>
          {queue?.ahead === 0 && "You’re next. "}
          Give the start code <strong className="tnum">{job.startOtp}</strong> when the technician arrives.
        </p>
      )}
      {job.status === "in_progress" && (
        <p>Give the completion code <strong className="tnum">{job.endOtp}</strong> once you’re happy with the work.</p>
      )}
    </div>
  );
}
