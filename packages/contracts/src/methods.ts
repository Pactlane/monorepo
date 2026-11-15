export const COMMERCE_METHODS = {
  create_job: "create_job",
  set_provider: "set_provider",
  set_budget: "set_budget",
  fund: "fund",
  submit: "submit",
  complete: "complete",
  reject: "reject",
  claim_refund: "claim_refund",
  extend_ttl: "extend_ttl",
  get_job: "get_job",
  get_jobs: "get_jobs",
  job_count: "job_count",
  token: "token",
  admin: "admin",
  upgrade: "upgrade",
} as const

export type CommerceMethod = keyof typeof COMMERCE_METHODS

export const COMMERCE_WRITE_METHODS = [
  "create_job",
  "set_provider",
  "set_budget",
  "fund",
  "submit",
  "complete",
  "reject",
  "claim_refund",
] as const satisfies readonly CommerceMethod[]

export const EVALUATION_POLICY_METHODS = {
  complete: "complete",
  reject: "reject",
  is_signer: "is_signer",
  owner: "owner",
  kernel: "kernel",
  add_signer: "add_signer",
  remove_signer: "remove_signer",
  propose_owner: "propose_owner",
  accept_owner: "accept_owner",
  upgrade: "upgrade",
} as const

export type EvaluationPolicyMethod = keyof typeof EVALUATION_POLICY_METHODS
