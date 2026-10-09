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
      {loaderData.simulation && <SimulationBanner />}
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
