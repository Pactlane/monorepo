import { Hono } from "hono"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { bodyLimit } from "hono/body-limit"
import type { Env } from "@pactlane/config"

export const VERSION = "0.1.0"

export function createApp(env: Env) {
  const app = new Hono().basePath("/v1")

  app.use("*", secureHeaders())
  app.use("*", cors({ origin: env.PUBLIC_APP_URL }))
  app.use("*", bodyLimit({ maxSize: 64 * 1024 }))

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      version: VERSION,
      network: env.STELLAR_NETWORK,
      mode: env.MOCK_EXTERNALS ? "simulation" : "live",
    })
  )

  app.notFound((c) => c.json({ error: "not_found" }, 404))
  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: "internal_error" }, 500)
  })

  return app
}
