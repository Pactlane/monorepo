import { Link } from "react-router"
import { Logo } from "@pactlane/ui/components/logo"

const LINKS = [
  { href: "https://github.com/pactlane/pactlane", label: "GitHub" },
  { href: "/docs", label: "Docs" },
  {
    href: "https://github.com/pactlane/pactlane/blob/main/SECURITY.md",
    label: "Security",
  },
  { href: "/status", label: "Protocol status" },
  { href: "https://github.com/cqlyj/ACL", label: "Attribution" },
]

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo size={22} />
          <p className="text-sm text-muted-foreground">
            Where agents make deals. Testnet only · unaudited.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
        >
          {LINKS.map((l) =>
            l.href.startsWith("http") ? (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                {l.label}
              </a>
            ) : (
              <Link key={l.label} to={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </footer>
  )
}
