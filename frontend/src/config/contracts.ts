/**
 * Deployed CredX Protocol contract addresses (Creditcoin Testnet, chainId 102031).
 * Mirror of ../contracts.json used by the frontend service layer.
 */

export const CREDITCOIN_CHAIN_ID = 102031;
export const CREDITCOIN_RPC = 'https://rpc.cc3-testnet.creditcoin.network';
export const CREDITCOIN_BLOCKSCOUT = 'https://creditcoin-testnet.blockscout.com';

/**
 * Google Maps JS API key. NEVER hard-code a key in source — set VITE_GOOGLE_MAPS_API_KEY
 * (frontend/.env) at build time. When empty, GoogleMapView renders its free OSM fallback.
 */
export const GOOGLE_MAPS_API_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

/**
 * RapidAPI (Binance43) key for live candle fetches. NEVER hard-code in source —
 * set VITE_RAPIDAPI_KEY (frontend/.env). When empty the live fetch is skipped
 * and the chart uses its local price path.
 */
export const RAPIDAPI_BINANCE_KEY: string = (import.meta.env.VITE_RAPIDAPI_KEY as string) || '';

export const CONTRACTS = {
  attestationVerifier: '0x34aA30efE2226ffC2E55607017FbA2F07e62b279',
  creditScoreEngine: '0xA31697bBd4900f8FA62015A51dA3c58972E96BB6',
  credXHub: '0x729b2D8B630c4241d051c92D4FeB31412846eE18',
  cUSD: '0xdec5170C46DC63D812c699E9dFE6561FFd1BF298',
  lendingPool: '0x84234C1403768D9A509c1241e5F39f81246880d2',
  creditAttestationSBT: '0xb22baF385067aF8d66823282bb4F2e3EECB60831',
  reputationAMM: '0x81463b6bf1A8DD535c6DAeF034cAb6ee92434c32',
  reputationFlashLoan: '0x4962e6AdF6E59C60058d09b7cA4516dD2410d637',
  reputationYieldVault: '0x630943C1eD77b375d2Bb70647090F18a05490bc1',
  rwaTreasuryYieldFund: '0x2be1E6044ACEE8868b775a8C48C05f569d1Af80A',
  rwaInvoiceFinancing: '0x05D41AE81c47078DcA0CFF4891A407F4D09E01aA',
  gamingEcosystemHub: '0x8008c8885AA72a32198159360FFA43bc8De94D75',
  dePINInfrastructureHub: '0x99b400D55dA3A9f9aDa967b1D60d9E3cBA2bB9Bc',
  autonomousAIHub: '0xEc1445818cF57507Ff46B8a72daa9F7A66B60a5D',
  reputationArena: '0x42ff8Ea2Bf277F96b7F7f31C07932bcd0C79c9F5',
  blockProverAttestationOracle: '0x4d11b60809724b0B67B28DA2f38438aE97f1C671',
  purposeBoundFunding: '0x551592C32a96555A04BB016c2DF7138A1f9DE644',
  usageMeteringRegistry: '0xF8a9645ac3D234cf72B0C4C170cFB289FE2Ae4F9',
  verifiedEscrow: '0x07aBcbb7b2F9f4400c93d092F343e186ee526137',
} as const;

/** Testnet settlement token decimals (MockERC20 with 18 decimals). */
export const CUSD_DECIMALS = 18;