import { expect, test } from "bun:test"
import { loadEnv } from "@pactlane/config"
import { createApp } from "./app"

const app = createApp(loadEnv({}))

test("health reports simulation mode without secrets", async () => {
  const res = await app.request("/v1/health")
  expect(res.status).toBe(200)
  const body = (await res.json()) as Record<string, unknown>
  expect(body).toEqual({
    status: "ok",
    version: "0.1.0",
    network: "testnet",
    mode: "simulation",
  })
})

test("unknown routes return json 404", async () => {
  const res = await app.request("/v1/nope")
  expect(res.status).toBe(404)
})
