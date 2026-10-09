import { createApp } from "@pactlane/api/app"
import { loadEnv } from "@pactlane/config"
import { PactlaneClient } from "@pactlane/sdk"

let client: PactlaneClient | undefined

export function api(): PactlaneClient {
  if (client) return client
  const remote = process.env.PACTLANE_API_URL
  if (remote) {
    client = new PactlaneClient({ apiUrl: remote })
  } else {
    const app = createApp(loadEnv())
    client = new PactlaneClient({
      apiUrl: "http://pactlane.internal",
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => app.request(input instanceof Request ? input : String(input), init)) as typeof fetch,
    })
  }
  return client
}

export const isSimulation = () => !process.env.PACTLANE_API_URL || process.env.MOCK_EXTERNALS !== "false"
