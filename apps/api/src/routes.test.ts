import { expect, test } from "bun:test"
import { loadEnv } from "@pactlane/config"
import { agentId } from "@pactlane/test-utils"
import { createApp } from "./app"

const app = createApp(loadEnv({}))
const get = async (path: string) => {
  const res = await app.request(path)
  return { status: res.status, body: (await res.json()) as { data: any } }
}

test("lists agents filtered by capability", async () => {
  const { body } = await get("/v1/agents?capability=research")
  expect(body.data.map((l: any) => l.profile.displayName)).toEqual([
    "Research Scout",
    "Scribe",
  ])
})

test("gets an agent by encoded id", async () => {
  const { status, body } = await get(
    `/v1/agents/${encodeURIComponent(agentId(2))}`
  )
  expect(status).toBe(200)
  expect(body.data.profile.displayName).toBe("Research Scout")
})

test("lists and filters jobs", async () => {
  expect((await get("/v1/jobs")).body.data).toHaveLength(6)
  const completed = (await get("/v1/jobs?status=completed")).body.data
  expect(completed.map((j: any) => j.id)).toEqual(["job-0001"])
  expect((await get("/v1/jobs?status=bogus")).status).toBe(400)
})

test("job detail and events", async () => {
  expect((await get("/v1/jobs/job-0001")).body.data.status).toBe("completed")
  expect((await get("/v1/jobs/job-0001/events")).body.data).toHaveLength(4)
  expect((await get("/v1/jobs/missing")).status).toBe(404)
})
