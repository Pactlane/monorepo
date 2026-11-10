import { isRouteErrorResponse, Link, Outlet } from "react-router"
import type { Route } from "./+types/shell"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function Shell() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-24">
        <p className="font-mono text-sm text-muted-foreground">
          {notFound ? "404" : "Unavailable"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {notFound
            ? "That page or job does not exist."
            : "Pactlane could not reach Stellar testnet."}
        </h1>
        {!notFound && (
          <p className="mt-3 text-muted-foreground">
            Job data is read live from the escrow kernel. The RPC did not
            answer, so try again in a moment.
          </p>
        )}
        <div className="mt-6 flex gap-4 text-sm">
          {!notFound && (
            <a href="" className="text-primary hover:underline">
              Try again
            </a>
          )}
          <Link to="/" className="text-primary hover:underline">
            Back to Pactlane
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
