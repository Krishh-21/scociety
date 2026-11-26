import Link from "next/link";
import { isDemoMode } from "@/lib/auth-mode";
import { BrandMark } from "./Brand";
import { MobileMenu } from "./marketing-client";
import "./marketing.css";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark size={30} />
      <span className="text-[20px] font-semibold tracking-[-0.02em] text-ink-900">jodo</span>
    </span>
  );
}

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#roles", label: "Who it’s for" },
  { href: "/#services", label: "Home services" },
  { href: "/partners", label: "Partners" },
  { href: "/help", label: "Help" },
];

/** Shared page gutter: 16px on phones, wider from tablets up, capped on big screens. */
export const WRAP = "w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8";

export function MarketingNav() {
  const links = isDemoMode() ? NAV : NAV.filter((link) => link.href !== "/#services");
  return (
    <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur-md border-b border-line">
      <div className={`${WRAP} relative h-16 flex items-center justify-between gap-3`}>
        <Link href="/" aria-label="JODO home" className="shrink-0 rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Site" className="hidden md:flex items-center gap-0.5 text-[14px] font-medium text-ink-700">
          {links.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-2 rounded-lg hover:bg-canvas-alt hover:text-ink-900">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/login"
            className="hidden min-[380px]:inline-flex btn mk-btn-outline h-10 min-h-10 px-4 text-[14px] whitespace-nowrap"
          >
            Sign in
          </Link>
          <Link href="/#request" className="hidden lg:inline-flex btn btn-primary h-10 min-h-10 px-4 text-[14px] whitespace-nowrap">
            Set up your society
          </Link>
          <MobileMenu links={links} />
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mk-navy">
      <div className={`${WRAP} pt-14 pb-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]`}>
        <div className="sm:col-span-2 lg:col-span-1">
          <span className="inline-flex items-center gap-2">
            <BrandMark size={30} />
            <span className="text-[20px] font-semibold tracking-[-0.02em]">jodo</span>
          </span>
          <p className="text-[15px] text-white/75 mt-4 max-w-sm leading-relaxed">
            One app for the gate, the notice board, the maintenance register and the helpdesk — shared by residents,
            the committee and security staff.
          </p>
          <Link href="/#request" className="btn mk-btn-light h-11 min-h-11 px-5 text-[14px] mt-6">
            Set up your society
          </Link>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["/#features", "Features"],
            ["/#roles", "Residents, committee & guards"],
            ...(isDemoMode() ? [["/#services", "Home services"] as [string, string]] : []),
            ["/login", "Sign in"],
          ]}
        />
        <FooterCol
          title="Work with us"
          links={[
            ["/#request", "Set up your society"],
            ["/partners", "Service partners"],
            ["/partners#apply", "Apply as a partner"],
          ]}
        />
        <FooterCol
          title="Support"
          links={[
            ["/help", "Help & FAQ"],
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
          ]}
        />
      </div>
      <div className="border-t border-white/10">
        <div className={`${WRAP} py-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-[13px] text-white/60`}>
          <p>© {new Date().getFullYear()} JODO. Built for apartment societies in India.</p>
          <p>Product illustrations use sample data.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-white/60 mb-4">{title}</p>
      <ul className="flex flex-col gap-2.5 text-[15px]">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-white/85 hover:text-white hover:underline underline-offset-4 rounded">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The root of every public page: scoped palette, nav, footer. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk min-h-screen flex flex-col bg-canvas text-ink-900 overflow-x-clip">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

/** Long-form pages (help, privacy, terms, partners) share this frame. */
export function MarketingPage({
  eyebrow,
  title,
  intro,
  aside,
  wide = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  /** Optional element shown beside the title on wide screens (a stat, a CTA). */
  aside?: React.ReactNode;
  /** Wider content column — for pages with grids rather than prose. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <header className="mk-grain border-b border-line">
        <div className={`${WRAP} pt-12 pb-10 sm:pt-16 sm:pb-14 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end [&>*]:min-w-0`}>
          <div className="max-w-3xl">
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            <h1 className="mk-display text-[38px] sm:text-[52px] lg:text-[60px]">{title}</h1>
            {intro && <div className="mk-lede text-[17px] sm:text-[18px] text-ink-700 leading-relaxed mt-5 max-w-2xl">{intro}</div>}
          </div>
          {aside}
        </div>
      </header>
      <div className={`${WRAP} pt-10 sm:pt-14 pb-16 sm:pb-24`}>
        <div className={wide ? "" : "max-w-3xl"}>{children}</div>
      </div>
    </MarketingShell>
  );
}

/** Prose block for policy pages — headings and paragraphs with sane spacing. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 text-[16px] leading-[1.7] text-ink-700 [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:text-ink-900 [&_h2]:mt-8 [&_h2]:scroll-mt-24 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_li]:marker:text-brand-600 [&_strong]:text-ink-900 [&_a]:text-brand-700 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2">
      {children}
    </div>
  );
}

/** Legal pages: a sticky contents list beside the prose on wide screens. */
export function LegalLayout({
  sections,
  children,
}: {
  sections: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
      <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow mb-3">On this page</p>
        <ol className="flex flex-wrap gap-2 lg:flex-col lg:gap-1 text-[14px]">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-block rounded-full lg:rounded-lg px-3 py-1.5 bg-canvas-alt lg:bg-transparent text-ink-700 hover:bg-canvas-alt hover:text-ink-900 font-medium"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="max-w-[720px]">{children}</div>
    </div>
  );
}

/** Shared by the landing page and /help. */
export function FaqList({ items }: { items: [string, string][] }) {
  return (
    <div className="border-t border-line">
      {items.map(([q, a]) => (
        <details key={q} className="group border-b border-line">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-4 py-5 font-medium text-[16px] sm:text-[17px] rounded-lg">
            {q}
            <span
              aria-hidden="true"
              className="w-8 h-8 shrink-0 rounded-full border border-line grid place-items-center text-ink-700 transition-transform group-open:rotate-45 text-[20px] leading-none"
            >
              +
            </span>
          </summary>
          <p className="text-[15px] text-ink-700 leading-relaxed pb-6 pr-10 -mt-1">{a}</p>
        </details>
      ))}
    </div>
  );
}
