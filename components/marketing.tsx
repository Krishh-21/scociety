import Link from "next/link";
import { MobileMenu } from "./marketing-client";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--color-brand-600)" />
        {/* three flats of a tower, the top one just joined */}
        <rect x="9" y="19" width="14" height="5" rx="1.5" fill="#fff" />
        <rect x="9" y="12.5" width="14" height="5" rx="1.5" fill="#fff" opacity=".85" />
        <rect x="9" y="6" width="14" height="5" rx="1.5" fill="#12a860" />
      </svg>
      <span className="text-[20px] font-extrabold tracking-tight text-ink-900">jodo</span>
    </span>
  );
}

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#services", label: "Services" },
  { href: "/#societies", label: "For societies" },
  { href: "/partners", label: "For vendors" },
  { href: "/help", label: "Help" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" aria-label="JODO home">
          <Logo />
        </Link>
        <nav aria-label="Site" className="hidden md:flex items-center gap-6 text-sm font-semibold text-ink-700">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-brand-700">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:inline-flex btn btn-quiet h-10 min-h-10 text-[14px]">
            Sign in
          </Link>
          <Link href="/login" className="btn btn-primary h-10 min-h-10 px-4 text-[14px] whitespace-nowrap">
            <span className="sm:hidden">Sign in</span>
            <span className="hidden sm:inline">Find your society</span>
          </Link>
          <MobileMenu links={NAV} />
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="text-sm text-ink-500 mt-3 max-w-xs leading-relaxed">
            Your building books together. One service, one day, one vendor — and the price falls as neighbours join.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["/#how", "How it works"],
            ["/#services", "Services"],
            ["/#promises", "Our promises"],
            ["/login", "Sign in"],
          ]}
        />
        <FooterCol
          title="Join us"
          links={[
            ["/#societies", "Bring JODO to your society"],
            ["/partners", "Become a vendor partner"],
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
      <div className="border-t border-line">
        <p className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-[13px] text-ink-500">
          © {new Date().getFullYear()} JODO. Made for gated societies in Pune, Bengaluru, Hyderabad and Thane.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-ink-700 hover:text-brand-700">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Long-form pages (help, privacy, terms, partners) share this frame. */
export function MarketingPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <MarketingNav />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-16">
          <p className="eyebrow mb-3 text-brand-700">{eyebrow}</p>
          <h1 className="text-[34px] sm:text-[42px] font-extrabold leading-[1.08] tracking-tight mb-4">{title}</h1>
          {intro && <div className="text-[17px] text-ink-700 leading-relaxed mb-10">{intro}</div>}
          {children}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

/** Prose block for policy pages — headings and paragraphs with sane spacing. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink-700 [&_h2]:text-[20px] [&_h2]:font-extrabold [&_h2]:text-ink-900 [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_strong]:text-ink-900">
      {children}
    </div>
  );
}
