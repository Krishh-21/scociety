export default function Loading() {
  return (
    <div role="status" className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
      <span className="sr-only">Loading JODO</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-10 w-2/3 max-w-xs rounded-xl bg-canvas-alt" />
        <div className="h-36 rounded-card bg-brand-50" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card space-y-4 p-5">
              <div className="h-4 w-24 rounded bg-canvas-alt" />
              <div className="h-6 w-3/4 rounded bg-canvas-alt" />
              <div className="h-3 w-full rounded-full bg-canvas-alt" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
