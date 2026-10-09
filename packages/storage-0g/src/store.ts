import { sha256Ref, type Sha256Ref } from "@pactlane/core"

export type ArtifactKind = "task" | "result" | "evaluation" | "transcript"

export interface StoredArtifact {
  uri: string
  plaintextSha256?: Sha256Ref
  storedSha256: Sha256Ref
  provider: "0g" | "memory"
  storageRoot?: string
  receipt?: string
}

export interface EvidenceStore {
  put(kind: ArtifactKind, data: Uint8Array): Promise<StoredArtifact>
  get(ref: StoredArtifact): Promise<Uint8Array>
  verify(ref: StoredArtifact, bytes: Uint8Array): Promise<boolean>
}

export class ArtifactIntegrityError extends Error {}

export async function getVerified(
  store: EvidenceStore,
  ref: StoredArtifact
): Promise<Uint8Array> {
  const bytes = await store.get(ref)
  if (!(await store.verify(ref, bytes))) {
    throw new ArtifactIntegrityError(
      `Artifact ${ref.uri} does not match ${ref.storedSha256}`
    )
  }
  return bytes
}

export class MemoryEvidenceStore implements EvidenceStore {
  private blobs = new Map<string, Uint8Array>()

  async put(kind: ArtifactKind, data: Uint8Array): Promise<StoredArtifact> {
    const hash = sha256Ref(data)
    const uri = `memory://${kind}/${hash.slice(7)}`
    this.blobs.set(uri, new Uint8Array(data))
    return {
      uri,
      storedSha256: hash,
      plaintextSha256: hash,
      provider: "memory",
    }
  }

  async get(ref: StoredArtifact): Promise<Uint8Array> {
    const bytes = this.blobs.get(ref.uri)
    if (!bytes) throw new Error(`Artifact not found: ${ref.uri}`)
    return new Uint8Array(bytes)
  }

  async verify(ref: StoredArtifact, bytes: Uint8Array): Promise<boolean> {
    return sha256Ref(bytes) === ref.storedSha256
  }

  corrupt(uri: string) {
    const bytes = this.blobs.get(uri)
    if (bytes && bytes.length) bytes[0] = bytes[0]! ^ 0xff
  }
}
