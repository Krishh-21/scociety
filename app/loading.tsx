export default function Loading() {
  return (
    <div className="min-h-screen flex justify-center bg-canvas-alt">
      <div className="w-full max-w-[460px] bg-canvas min-h-screen border-x border-line p-4">
        <div className="h-16 rounded-2xl bg-canvas-alt animate-pulse mb-4" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-4 mb-3">
            <div className="h-3 w-24 rounded bg-canvas-alt animate-pulse mb-3" />
            <div className="h-5 w-3/4 rounded bg-canvas-alt animate-pulse mb-4" />
            <div className="h-9 w-1/2 rounded bg-canvas-alt animate-pulse mb-4" />
            <div className="h-2.5 w-full rounded-full bg-canvas-alt animate-pulse" />
          </div>
        ))}
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
