import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { sha256Hex } from "@pactlane/core"
import { parseManifest, type DeploymentManifest } from "./manifest"

export interface LoadManifestOptions {
  expectedSha256?: string
  reviewed?: boolean
  baseDir?: string
  fetch?: typeof fetch
}

async function readBytes(
  ref: string,
  opts: LoadManifestOptions
): Promise<Uint8Array> {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) && !/^[a-z]:[\\/]/i.test(ref)) {
    const url = new URL(ref)
    if (url.protocol === "file:") return readFile(fileURLToPath(url))
    if (url.protocol === "https:") {
      const res = await (opts.fetch ?? fetch)(url, { redirect: "error" })
      if (!res.ok)
        throw new Error(`Manifest download failed with HTTP ${res.status}`)
      return new Uint8Array(await res.arrayBuffer())
    }
    throw new Error(
      `Refusing manifest over ${url.protocol}; use a file path or https:// URL`
    )
  }
  return readFile(
    isAbsolute(ref) ? ref : resolve(opts.baseDir ?? process.cwd(), ref)
  )
}

export async function loadManifest(
  ref: string,
  opts: LoadManifestOptions = {}
): Promise<DeploymentManifest> {
  if (!ref.trim()) throw new Error("No deployment manifest reference given")
  const bytes = await readBytes(ref.trim(), opts)
  if (opts.expectedSha256) {
    const expected = opts.expectedSha256.replace(/^sha256:/, "").toLowerCase()
    const actual = sha256Hex(bytes)
    if (actual !== expected) {
      throw new Error(
        `Manifest pin mismatch: expected sha256 ${expected}, got ${actual}`
      )
    }
  }
  let json: unknown
  try {
    json = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error("Deployment manifest is not valid JSON")
  }
  return parseManifest(json, { reviewed: opts.reviewed })
}
