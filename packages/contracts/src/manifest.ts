import { z } from "zod"
import { isAccountAddress, isContractAddress } from "@pactlane/core/address"
import { NETWORKS } from "@pactlane/core/network"

const contractId = z
  .string()
  .refine(
    isContractAddress,
    "Expected a C... contract id with a valid checksum"
  )
const address = z
  .string()
  .refine(
    (v) => isAccountAddress(v) || isContractAddress(v),
    "Expected a G... or C... address with a valid checksum"
  )
const wasmHash = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Expected a 64-character lowercase hex wasm hash")
const gitCommit = z
  .string()
  .regex(/^[0-9a-f]{40}$/, "Expected a 40-character git commit")
const timestamp = z.iso.datetime({ offset: true })

const builtWith = z.strictObject({ rustc: z.string(), stellarCli: z.string() })

function deployment<T extends z.ZodRawShape>(constructorArgs: z.ZodObject<T>) {
  return z.strictObject({
    contractId,
    wasmSha256: wasmHash,
    gitCommit,
    deployedAt: timestamp,
    upgradedAt: timestamp.optional(),
    constructorArgs,
    builtWith,
  })
}

export const deploymentManifestSchema = z
  .strictObject({
    $schema: z.string().optional(),
    schemaVersion: z.literal(1),
    network: z.enum(["testnet", "mainnet"]),
    networkPassphrase: z.string().min(1),
    contracts: z.strictObject({
      "pactlane-commerce": deployment(
        z.strictObject({ token: contractId, admin: address })
      ),
      "pactlane-evaluation-policy": deployment(
        z.strictObject({ owner: address, kernel: contractId })
      ).optional(),
    }),
  })
  .superRefine((m, ctx) => {
    if (m.networkPassphrase !== NETWORKS[m.network].passphrase) {
      ctx.addIssue({
        code: "custom",
        path: ["networkPassphrase"],
        message: `Passphrase does not match network ${m.network}`,
      })
    }
    const policy = m.contracts["pactlane-evaluation-policy"]
    if (
      policy &&
      policy.constructorArgs.kernel !==
        m.contracts["pactlane-commerce"].contractId
    ) {
      ctx.addIssue({
        code: "custom",
        path: [
          "contracts",
          "pactlane-evaluation-policy",
          "constructorArgs",
          "kernel",
        ],
        message: "Evaluation policy is bound to a different kernel",
      })
    }
  })

export type DeploymentManifest = z.output<typeof deploymentManifestSchema>

export class ManifestError extends Error {
  override readonly name = "ManifestError"
  readonly issues: string[]
  constructor(issues: string[]) {
    super(
      `Invalid deployment manifest:\n${issues.map((i) => `  ${i}`).join("\n")}`
    )
    this.issues = issues
  }
}

export interface ParseManifestOptions {
  reviewed?: boolean
}

export function parseManifest(
  input: unknown,
  opts: ParseManifestOptions = {}
): DeploymentManifest {
  const parsed = deploymentManifestSchema.safeParse(input)
  if (!parsed.success) {
    throw new ManifestError(
      parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      )
    )
  }
  if (parsed.data.network === "mainnet" && opts.reviewed !== true) {
    throw new ManifestError([
      "network: mainnet manifests are refused unless explicitly reviewed (pass { reviewed: true })",
    ])
  }
  return parsed.data
}
