export interface NonceStore {
  has(key: string): boolean | Promise<boolean>
  add(key: string, expiresAtUnix: number): void | Promise<void>
}

export class MemoryNonceStore implements NonceStore {
  private seen = new Map<string, number>()

  has(key: string) {
    return this.seen.has(key)
  }

  add(key: string, expiresAtUnix: number) {
    this.seen.set(key, expiresAtUnix)
  }

  prune(nowUnix: number) {
    for (const [k, exp] of this.seen) if (exp < nowUnix) this.seen.delete(k)
  }
}

export const replayKey = (sender: string, nonce: string, domain: string) => `${domain}|${sender}|${nonce}`
