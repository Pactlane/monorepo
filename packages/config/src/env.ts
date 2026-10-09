import { z } from "zod"

export const STELLAR_NETWORKS = {
  testnet: {
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "",
  },
} as const

export type StellarNetwork = keyof typeof STELLAR_NETWORKS

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
    STELLAR_RPC_URL: z.url().optional(),
    STELLAR_NETWORK_PASSPHRASE: z.string().optional(),
    PACTLANE_DEPLOYMENT_MANIFEST: z.string().optional(),
    USDC_ASSET_CONTRACT_ID: z.string().optional(),
    STELLAR_8004_IDENTITY_REGISTRY_ID: z.string().optional(),
    STELLAR_8004_REPUTATION_REGISTRY_ID: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    VALKEY_URL: z.string().optional(),
    PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    AXL_NODE_URL: z.string().optional(),
    OG_STORAGE_RPC_URL: z.string().optional(),
    OG_STORAGE_INDEXER_URL: z.string().optional(),
    OG_COMPUTE_PROVIDER: z.string().optional(),
    MOCK_EXTERNALS: bool.default(true),
  })
  .transform((env, ctx) => {
    const defaults = STELLAR_NETWORKS[env.STELLAR_NETWORK]
    const passphrase = env.STELLAR_NETWORK_PASSPHRASE ?? defaults.passphrase
    if (passphrase !== defaults.passphrase) {
      ctx.addIssue({
        code: "custom",
        path: ["STELLAR_NETWORK_PASSPHRASE"],
        message: `Passphrase does not match STELLAR_NETWORK=${env.STELLAR_NETWORK}`,
      })
    }
    if (env.STELLAR_NETWORK === "mainnet" && env.MOCK_EXTERNALS) {
      ctx.addIssue({
        code: "custom",
        path: ["MOCK_EXTERNALS"],
        message: "Simulation mode cannot run against mainnet",
      })
    }
    return {
      ...env,
      STELLAR_NETWORK_PASSPHRASE: passphrase,
      STELLAR_RPC_URL: env.STELLAR_RPC_URL ?? defaults.rpcUrl,
    }
  })

export type Env = z.output<typeof envSchema>

export function loadEnv(
  source: Record<string, string | undefined> = process.env
): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(`Invalid Pactlane environment:\n${issues}`)
  }
  return parsed.data
}
