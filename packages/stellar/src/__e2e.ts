import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk"
import {
  KERNEL_EVENT_NAMES,
  KernelClient,
  PACTLANE_TESTNET as D,
  buildUsdcTrustline,
  createRpc,
  decodeEvent,
  fundTestnetAccount,
  ledgerNow,
  readTokenBalance,
  submitAndWait,
  usdcAsset,
  type HorizonAccount,
} from "./index"
import { KeypairSigner } from "./signer.test-only"

const WEB = process.env.WEB ?? "http://localhost:3130"
const P = D.networkPassphrase
const USDC = 10_000_000n
const rpc = await createRpc({ rpcUrl: D.rpcUrl, networkPassphrase: P })
const kernel = new KernelClient({ rpc })
let failures = 0

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`
  )
}

const horizon = (a: string): Promise<HorizonAccount> =>
  fetch(`https://horizon-testnet.stellar.org/accounts/${a}`).then(
    (r) => r.json() as Promise<HorizonAccount>
  )

async function classic(
  kp: Keypair,
  build: (b: TransactionBuilder) => TransactionBuilder
) {
  const account = await rpc.getAccount(kp.publicKey())
  const tx = build(
    new TransactionBuilder(account, { fee: "1000", networkPassphrase: P })
  )
    .setTimeout(120)
    .build()
  tx.sign(kp)
  return submitAndWait(rpc, tx.toXDR(), {
    networkPassphrase: P,
    timeoutMs: 60_000,
  })
}

async function api(body: unknown) {
  const res = await fetch(`${WEB}/api/tx`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json()) as Record<string, any> }
}

async function act(signer: KeypairSigner, call: Record<string, unknown>) {
  const source = await signer.address()
  const prep = await api({ intent: "prepare", source, call })
  if (prep.status !== 200)
    return { ok: false, error: prep.json.error as string }
  const signed = await signer.signTransaction(prep.json.xdr, {
    networkPassphrase: P,
  })
  const sub = await api({ intent: "submit", xdr: signed })
  return {
    ok: sub.json.status === "success",
    value: sub.json.value as string | null,
    error: sub.json.error ?? sub.json.status,
    hash: sub.json.hash as string,
  }
}

async function must(
  label: string,
  signer: KeypairSigner,
  call: Record<string, unknown>
) {
  const r = await act(signer, call)
  check(label, r.ok, r.ok ? `tx ${r.hash?.slice(0, 10)}` : String(r.error))
  return r
}

const bal = (a: string) => readTokenBalance(rpc, D.token, a)
const spec = (n: number) =>
  `sha256:${n.toString(16).padStart(2, "0").repeat(32)}`

console.log("== wallets")
const kps = {
  client: Keypair.random(),
  provider: Keypair.random(),
  evaluator: Keypair.random(),
  stranger: Keypair.random(),
}
const s = Object.fromEntries(
  Object.entries(kps).map(([k, v]) => [k, new KeypairSigner(v)])
) as Record<keyof typeof kps, KeypairSigner>
const addr = Object.fromEntries(
  Object.entries(kps).map(([k, v]) => [k, v.publicKey()])
) as Record<keyof typeof kps, string>
for (const [k, a] of Object.entries(addr)) console.log(`  ${k.padEnd(9)} ${a}`)
await Promise.all(Object.values(addr).map((a) => fundTestnetAccount(a)))

for (const who of ["client", "provider"] as const) {
  const xdr = buildUsdcTrustline({ account: await horizon(addr[who]) })
  const signed = await s[who].signTransaction(xdr, { networkPassphrase: P })
  const r = await submitAndWait(rpc, signed, {
    networkPassphrase: P,
    timeoutMs: 60_000,
  })
  check(`${who} USDC trustline`, r.status === "success")
}
const swap = await classic(kps.client, (b) =>
  b.addOperation(
    Operation.pathPaymentStrictSend({
      sendAsset: Asset.native(),
      sendAmount: "50",
      destination: addr.client,
      destAsset: new Asset("USDC", usdcAsset().issuer),
      destMin: "10",
      path: [],
    })
  )
)
const startBalance = await bal(addr.client)
check(
  "client bought USDC on the testnet DEX",
  swap.status === "success" && startBalance >= 10n * USDC,
  `${startBalance} base units`
)
const startLedger = (await rpc.getLatestLedger()).sequence
const now = await ledgerNow(rpc)

console.log("\n== negative checks")
const conflict = await act(s.client, {
  method: "create_job",
  client: addr.client,
  evaluator: addr.client,
  provider: null,
  expiresAt: now + 86_400,
  specHash: spec(1),
})
check(
  "evaluator == client is refused",
  !conflict.ok && /three different/.test(String(conflict.error)),
  String(conflict.error)
)
const longExpiry = await act(s.client, {
  method: "create_job",
  client: addr.client,
  evaluator: addr.evaluator,
  provider: null,
  expiresAt: now + 91 * 86_400,
  specHash: spec(1),
})
check(
  "expiry over 90 days is refused",
  !longExpiry.ok && /90 days/.test(String(longExpiry.error)),
  String(longExpiry.error)
)

console.log("\n== job A: happy path")
const a = await must("create_job with provider", s.client, {
  method: "create_job",
  client: addr.client,
  provider: addr.provider,
  evaluator: addr.evaluator,
  expiresAt: now + 86_400,
  specHash: spec(0xa),
})
const idA = a.value!
await must("client proposes 2 USDC", s.client, {
  method: "set_budget",
  id: idA,
  actor: addr.client,
  amount: String(2n * USDC),
})
const mismatch = await act(s.client, {
  method: "fund",
  id: idA,
  expectedBudget: String(3n * USDC),
})
check(
  "fund with a stale budget is refused",
  !mismatch.ok && /budget changed/.test(String(mismatch.error)),
  String(mismatch.error)
)
const stranger = await act(s.stranger, {
  method: "fund",
  id: idA,
  expectedBudget: String(2n * USDC),
})
check("a stranger cannot fund", !stranger.ok, String(stranger.error))
const early = await act(s.provider, {
  method: "submit",
  id: idA,
  workHash: spec(0xb),
})
check("submit before funding is refused", !early.ok, String(early.error))
await must("client funds escrow", s.client, {
  method: "fund",
  id: idA,
  expectedBudget: String(2n * USDC),
})
check(
  "client paid exactly 2 USDC",
  (await bal(addr.client)) === startBalance - 2n * USDC
)
const wrongEval = await act(s.client, {
  method: "complete",
  id: idA,
  reason: spec(0xc),
})
check("client cannot approve", !wrongEval.ok, String(wrongEval.error))
await must("provider submits work", s.provider, {
  method: "submit",
  id: idA,
  workHash: spec(0xb),
})
await must("evaluator approves", s.evaluator, {
  method: "complete",
  id: idA,
  reason: spec(0xc),
})
const jobA = await kernel.getJob(BigInt(idA))
check(
  "job A completed on-chain",
  jobA?.status === "completed" &&
    jobA.workHash === spec(0xb) &&
    jobA.reason === spec(0xc)
)
check("provider received 2 USDC", (await bal(addr.provider)) === 2n * USDC)

console.log(
  "\n== job B: provider set later, evaluator rejects, client refunded"
)
const b = await must("create_job without provider", s.client, {
  method: "create_job",
  client: addr.client,
  provider: null,
  evaluator: addr.evaluator,
  expiresAt: now + 86_400,
  specHash: spec(0x1b),
})
const idB = b.value!
await must("client sets provider", s.client, {
  method: "set_provider",
  id: idB,
  provider: addr.provider,
})
await must("provider proposes 1 USDC", s.provider, {
  method: "set_budget",
  id: idB,
  actor: addr.provider,
  amount: String(USDC),
})
const beforeB = await bal(addr.client)
await must("client funds", s.client, {
  method: "fund",
  id: idB,
  expectedBudget: String(USDC),
})
await must("evaluator rejects funded job", s.evaluator, {
  method: "reject",
  id: idB,
  reason: spec(0x2b),
})
check(
  "job B rejected and client refunded",
  (await kernel.getJob(BigInt(idB)))?.status === "rejected" &&
    (await bal(addr.client)) === beforeB
)

console.log("\n== job C: client cancels an open job")
const c = await must("create_job", s.client, {
  method: "create_job",
  client: addr.client,
  provider: addr.provider,
  evaluator: addr.evaluator,
  expiresAt: now + 86_400,
  specHash: spec(0x1c),
})
await must("client cancels", s.client, {
  method: "reject",
  id: c.value!,
  reason: null,
})
check(
  "job C rejected",
  (await kernel.getJob(BigInt(c.value!)))?.status === "rejected"
)

console.log("\n== job D: expiry and permissionless refund")
const expiresAt = (await ledgerNow(rpc)) + 75
const d = await must("create_job expiring in 75s", s.client, {
  method: "create_job",
  client: addr.client,
  provider: addr.provider,
  evaluator: addr.evaluator,
  expiresAt,
  specHash: spec(0x1d),
})
const idD = d.value!
await must("client proposes 1 USDC", s.client, {
  method: "set_budget",
  id: idD,
  actor: addr.client,
  amount: String(USDC),
})
const beforeD = await bal(addr.client)
await must("client funds", s.client, {
  method: "fund",
  id: idD,
  expectedBudget: String(USDC),
})
const tooSoon = await act(s.stranger, { method: "claim_refund", id: idD })
check(
  "refund before expiry is refused",
  !tooSoon.ok && /not expired/.test(String(tooSoon.error)),
  String(tooSoon.error)
)
while ((await ledgerNow(rpc, () => Date.now() + 10_000)) < expiresAt)
  await Bun.sleep(5000)
const late = await act(s.provider, {
  method: "submit",
  id: idD,
  workHash: spec(0x2d),
})
check(
  "submit after expiry is refused",
  !late.ok && /expired/i.test(String(late.error)),
  String(late.error)
)
await must("a stranger claims the refund", s.stranger, {
  method: "claim_refund",
  id: idD,
})
check(
  "job D expired and client refunded",
  (await kernel.getJob(BigInt(idD)))?.status === "expired" &&
    (await bal(addr.client)) === beforeD
)

console.log("\n== events")
const events = await rpc.getEvents({
  startLedger,
  filters: [{ type: "contract", contractIds: [D.kernel] }],
  limit: 200,
})
const decoded = events.events
  .map((e) => decodeEvent(e, KERNEL_EVENT_NAMES))
  .filter((e) => e !== null)
const mine = decoded.filter((e) =>
  [idA, idB, c.value, idD].includes(String(e.topics[0]))
)
const names = mine.reduce<Record<string, number>>(
  (m, e) => ((m[e.name] = (m[e.name] ?? 0) + 1), m),
  {}
)
console.log("  ", JSON.stringify(names))
const third = (name: string, who: string) =>
  mine.filter((e) => e.name === name).every((e) => e.topics[1] === who)
check("job_funded third topic is the client", third("job_funded", addr.client))
check(
  "job_submitted third topic is the provider",
  third("job_submitted", addr.provider)
)
check(
  "job_completed third topic is the evaluator",
  third("job_completed", addr.evaluator)
)
check(
  "payment_released event for job A",
  mine.some((e) => e.name === "payment_released" && String(e.topics[0]) === idA)
)
check(
  "refunded events for jobs B and D",
  [idB, idD].every((id) =>
    mine.some((e) => e.name === "refunded" && String(e.topics[0]) === id)
  )
)

console.log("\n== site")
for (const [path, needle] of [
  ["/jobs", `#${idA}`],
  [`/jobs/${idA}`, "Completed"],
  [`/jobs/${idD}`, "Expired"],
  ["/explore", addr.provider.slice(0, 4)],
  [`/agents/${addr.provider}`, "2.00 USDC"],
  ["/", "Jobs on the kernel"],
] as const) {
  const res = await fetch(`${WEB}${path}`)
  const html = await res.text()
  check(
    `GET ${path} shows ${needle}`,
    res.status === 200 && html.includes(needle),
    `HTTP ${res.status}`
  )
}

console.log(`\nJobs: A=${idA} B=${idB} C=${c.value} D=${idD}`)
console.log(failures ? `${failures} FAILED` : "ALL PASSED")
process.exit(failures ? 1 : 0)
