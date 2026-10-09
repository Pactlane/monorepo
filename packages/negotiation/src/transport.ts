import type { SignedEnvelope } from "./envelope"

export type EnvelopeHandler = (message: SignedEnvelope) => Promise<void>

export interface NegotiationTransport {
  readonly peerId: string
  send(peerId: string, envelope: SignedEnvelope): Promise<void>
  receive(handler: EnvelopeHandler): Promise<void>
  health(): Promise<{ ready: boolean }>
}

export class LocalHub {
  private peers = new Map<string, EnvelopeHandler[]>()

  connect(peerId: string): LocalTransport {
    if (!this.peers.has(peerId)) this.peers.set(peerId, [])
    return new LocalTransport(peerId, this)
  }

  subscribe(peerId: string, handler: EnvelopeHandler) {
    this.peers.get(peerId)?.push(handler)
  }

  async deliver(peerId: string, envelope: SignedEnvelope) {
    const handlers = this.peers.get(peerId)
    if (!handlers) throw new Error(`Unknown peer: ${peerId}`)
    const copy = structuredClone(envelope)
    await Promise.all(handlers.map((h) => h(copy)))
  }
}

export class LocalTransport implements NegotiationTransport {
  constructor(
    readonly peerId: string,
    private hub: LocalHub
  ) {}

  send(peerId: string, envelope: SignedEnvelope) {
    return this.hub.deliver(peerId, envelope)
  }

  async receive(handler: EnvelopeHandler) {
    this.hub.subscribe(this.peerId, handler)
  }

  async health() {
    return { ready: true }
  }
}
