import { isAccountAddress } from "@pactlane/core/address"
import type { Route } from "./+types/api.balance"
import { describeError, getBalances } from "@/lib/chain.server"

export async function loader({ request }: Route.LoaderArgs) {
  const address = new URL(request.url).searchParams.get("address")
  if (!isAccountAddress(address)) {
    return Response.json({ error: "Invalid account address" }, { status: 400 })
  }
  try {
    return Response.json(await getBalances(address), {
      headers: { "cache-control": "no-store" },
    })
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 })
  }
}
