import { z } from "zod"
import type { KernelCall } from "@pactlane/stellar"
import type { Route } from "./+types/api.tx"
import {
  describeError,
  prepareKernelCall,
  submitSigned,
} from "@/lib/chain.server"

const address = z.string().regex(/^[GC][A-Z2-7]{55}$/, "Invalid address")
const id = z
  .string()
  .regex(/^[1-9]\d{0,19}$/)
  .transform(BigInt)
const amount = z
  .string()
  .regex(/^[1-9]\d{0,38}$/)
  .transform(BigInt)
const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/)

const call = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("create_job"),
    client: address,
    provider: address.nullish(),
    evaluator: address,
    expiresAt: z.number().int().positive(),
    specHash: hash,
  }),
  z.object({ method: z.literal("set_provider"), id, provider: address }),
  z.object({
    method: z.literal("set_budget"),
    id,
    actor: address,
    amount,
  }),
  z.object({ method: z.literal("fund"), id, expectedBudget: amount }),
  z.object({ method: z.literal("submit"), id, workHash: hash }),
  z.object({ method: z.literal("complete"), id, reason: hash }),
  z.object({ method: z.literal("reject"), id, reason: hash.nullish() }),
  z.object({ method: z.literal("claim_refund"), id }),
])

const body = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("prepare"), source: address, call }),
  z.object({
    intent: z.literal("submit"),
    xdr: z.string().min(1).max(20_000),
  }),
])

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 })
  }
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }
  try {
    if (parsed.data.intent === "prepare") {
      const prepared = await prepareKernelCall(
        parsed.data.source,
        parsed.data.call as KernelCall
      )
      return Response.json(prepared)
    }
    return Response.json(await submitSigned(parsed.data.xdr))
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 422 })
  }
}
