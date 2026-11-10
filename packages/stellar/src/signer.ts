export interface SignOptions {
  networkPassphrase: string
  address?: string
}

export interface Signer {
  address(): Promise<string>
  signTransaction(xdr: string, opts: SignOptions): Promise<string>
  signAuthEntry?(preimageXdr: string, opts: SignOptions): Promise<string>
}
