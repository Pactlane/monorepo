import type { StellarNetwork } from "@pactlane/config"

export const STELLAR_8004_UPSTREAM = {
  repository: "https://github.com/trionlabs/stellar-8004",
  commit: "7718e29d70afd25e62116c9ab667b13e9e9803e9",
} as const

export interface Stellar8004Registries {
  identity: string
  reputation: string
  validation: string
}

export const STELLAR_8004_REGISTRIES: Record<
  StellarNetwork,
  Stellar8004Registries
> = {
  testnet: {
    identity: "CDE3K4COIAGWNNJQQLL26SYI3KBJF5FUDHXG5FA6GYDJCG7T5V7FIWZH",
    reputation: "CBZEAGIEI3HXMDRLF44KLQJQQOH6LCYWWSGJVSYQYQO2HQ6DDGZ7HT55",
    validation: "CC5USZRO26MOIAVNYTTJDS63C2OBBLREOAOET4CPF2EZWO3YFKLMO3SL",
  },
  mainnet: {
    identity: "CBGPDCJIHQ32G42BE7F2CIT3YW6XRN5ED6GQJHCRZSNAYH6TGMCL6X35",
    reputation: "CBOIAIMMWAXI57OATLX6BWVDQLCC4YU55HV6MZXFRP6CBSGAMXSTEPPA",
    validation: "CBT6WWEVEPT2UFGFGVJJ7ELYGLQAGRYSVGDTGMCJTRWXOH27MWUO7UJG",
  },
}
