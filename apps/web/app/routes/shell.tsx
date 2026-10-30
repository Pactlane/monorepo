import { Outlet } from "react-router"
import type { Route } from "./+types/shell"
import { isSimulation } from "@/lib/api.server"
import { SimulationBanner } from "@/components/simulation-banner"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function loader() {
  return { simulation: isSimulation() }
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      {loaderData.simulation && <SimulationBanner />}
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
