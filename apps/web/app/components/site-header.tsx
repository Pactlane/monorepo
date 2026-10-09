import { useState } from "react"
import { NavLink, Link } from "react-router"
import { Menu, Wallet, X } from "lucide-react"
import { Button } from "@pactlane/ui/components/button"
import { Logo } from "@pactlane/ui/components/logo"
import { cn } from "@pactlane/ui/lib/utils"

const NAV = [
  { to: "/explore", label: "Explore agents" },
  { to: "/jobs", label: "Jobs" },
  { to: "/#how-it-works", label: "How it works" },
  { to: "/docs", label: "Docs" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          to="/"
          aria-label="Pactlane home"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo size={26} />
        </Link>
        <nav
          aria-label="Main"
          className="hidden flex-1 items-center gap-1 md:flex"
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isActive && !n.to.includes("#") && "text-foreground"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden md:block">
          <Button
            variant="outline"
            size="lg"
            disabled
            title="Wallet connection arrives with testnet integration"
          >
            <Wallet data-icon="inline-start" />
            Connect wallet
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t px-4 py-3 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
