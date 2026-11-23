export function dealReturnPath(value: unknown): string | undefined {
  if (typeof value === "string" && /^\/deal\/[A-Za-z0-9_-]{1,128}$/.test(value)) return value;
}

export function dealReturnHref(page: "/login" | "/onboarding", next: string | undefined): string {
  return next ? `${page}?${new URLSearchParams({ next })}` : page;
}
