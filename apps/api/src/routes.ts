import { Hono } from "hono"
import { z } from "zod"
import { JOB_STATUSES } from "@pactlane/core"
import type { Repository } from "./repository"

const limit = z.coerce.number().int().min(1).max(100).optional()

const agentQuery = z.object({
  capability: z.string().max(48).optional(),
  q: z.string().max(80).optional(),
  verified: z.enum(["true", "false"]).optional(),
  limit,
})

const jobQuery = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  agent: z.string().max(200).optional(),
  limit,
})

export function agentRoutes(repo: Repository) {
  return new Hono()
    .get("/", async (c) => {
      const parsed = agentQuery.safeParse(c.req.query())
      if (!parsed.success)
        return c.json(
          { error: "invalid_query", issues: parsed.error.issues },
          400
        )
      const { capability, q, verified, limit } = parsed.data
      const data = await repo.directory.search({
        capability,
        text: q,
        verifiedOnly: verified === "true",
        limit,
      })
      return c.json({ data })
    })
    .get("/:id", async (c) => {
      const listing = await repo.directory.get(c.req.param("id"))
      return listing
        ? c.json({ data: listing })
        : c.json({ error: "not_found" }, 404)
    })
    .get("/:id/jobs", async (c) =>
      c.json({ data: await repo.listJobs({ agentId: c.req.param("id") }) })
    )
}

export function jobRoutes(repo: Repository) {
  return new Hono()
    .get("/", async (c) => {
      const parsed = jobQuery.safeParse(c.req.query())
      if (!parsed.success)
        return c.json(
          { error: "invalid_query", issues: parsed.error.issues },
          400
        )
      const { status, agent, limit } = parsed.data
      return c.json({
        data: await repo.listJobs({ status, agentId: agent, limit }),
      })
    })
    .get("/:id", async (c) => {
      const job = await repo.getJob(c.req.param("id"))
      return job ? c.json({ data: job }) : c.json({ error: "not_found" }, 404)
    })
    .get("/:id/events", async (c) => {
      const job = await repo.getJob(c.req.param("id"))
      return job
        ? c.json({ data: job.events })
        : c.json({ error: "not_found" }, 404)
    })
}
