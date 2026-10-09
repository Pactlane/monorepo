import { loadEnv } from "@pactlane/config"
import { createApp } from "./app"

const env = loadEnv()
const app = createApp(env)

export default { port: env.API_PORT, fetch: app.fetch }

console.log(
  `pactlane api listening on :${env.API_PORT} (${env.MOCK_EXTERNALS ? "SIMULATION" : "live"})`
)
