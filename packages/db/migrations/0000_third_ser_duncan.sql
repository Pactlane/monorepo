CREATE TYPE "public"."artifact_kind" AS ENUM('task', 'result', 'evaluation', 'transcript');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('open', 'funded', 'submitted', 'completed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."network" AS ENUM('testnet', 'mainnet');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stellar_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_stellar_address_unique" UNIQUE("stellar_address")
);
--> statement-breakpoint
CREATE TABLE "agent_capabilities" (
	"agent_id" text NOT NULL,
	"capability" text NOT NULL,
	"domain" text,
	CONSTRAINT "agent_capabilities_agent_id_capability_pk" PRIMARY KEY("agent_id","capability")
);
--> statement-breakpoint
CREATE TABLE "agent_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"transport" text NOT NULL,
	"endpoint" text NOT NULL,
	"healthy" boolean DEFAULT false NOT NULL,
	"last_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registry_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"owner_address" text NOT NULL,
	"display_name" text NOT NULL,
	"metadata_hash" text,
	"profile" jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"last_verified_ledger" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_profiles_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "api_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "indexer_cursors" (
	"network" "network" PRIMARY KEY NOT NULL,
	"last_finalized_ledger" bigint NOT NULL,
	"last_tx_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" "artifact_kind" NOT NULL,
	"content_hash" text NOT NULL,
	"uri" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_events" (
	"network" "network" NOT NULL,
	"tx_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"contract_id" text NOT NULL,
	"type" text NOT NULL,
	"ledger" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "job_events_network_tx_hash_event_index_pk" PRIMARY KEY("network","tx_hash","event_index")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" "network" NOT NULL,
	"contract_id" text NOT NULL,
	"onchain_job_id" text NOT NULL,
	"title" text NOT NULL,
	"buyer" text NOT NULL,
	"provider" text NOT NULL,
	"evaluator" text NOT NULL,
	"budget_atomic" text NOT NULL,
	"status" "job_status" NOT NULL,
	"task_spec_hash" text NOT NULL,
	"agreement_hash" text,
	"work_deadline" timestamp with time zone NOT NULL,
	"evaluation_deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_agent" text NOT NULL,
	"provider_agent" text NOT NULL,
	"transcript_root" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"signed_payload_hash" text NOT NULL,
	"amount_atomic" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quotes_signed_payload_hash_unique" UNIQUE("signed_payload_hash")
);
--> statement-breakpoint
CREATE TABLE "reputation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"registry_id" text NOT NULL,
	"ledger" bigint NOT NULL,
	"score" integer NOT NULL,
	"provenance" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"step" text NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"next_retry" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "workflow_runs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "agent_capabilities" ADD CONSTRAINT "agent_capabilities_agent_id_agent_profiles_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("agent_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_endpoints" ADD CONSTRAINT "agent_endpoints_agent_id_agent_profiles_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("agent_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_sessions" ADD CONSTRAINT "api_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_artifacts" ADD CONSTRAINT "job_artifacts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_capabilities_cap_idx" ON "agent_capabilities" USING btree ("capability");--> statement-breakpoint
CREATE INDEX "agent_profiles_owner_idx" ON "agent_profiles" USING btree ("owner_address");--> statement-breakpoint
CREATE INDEX "job_events_contract_ledger_idx" ON "job_events" USING btree ("contract_id","ledger");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_chain_uidx" ON "jobs" USING btree ("network","contract_id","onchain_job_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "jobs_provider_idx" ON "jobs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "jobs_buyer_idx" ON "jobs" USING btree ("buyer");