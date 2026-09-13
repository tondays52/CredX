/**
 * demoWallets.ts — CC3 testnet DEMO wallet vault.
 * These are throwaway Creditcoin TESTNET keys funded only with faucet/test tokens so
 * the CredX live demo can sign real on-chain transactions fully in-browser (register,
 * heartbeats, epoch anchors, batch commits, claims) with no external wallet required.
 * They hold NO mainnet value. Never reuse these for anything real.
 */
export interface DemoWalletVaultEntry {
  id: string;
  label: string;
  role: string;
  address: string;
  privateKey: string;
}
export const CC3_DEMO_ROOT_ADDRESS = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';
export const DEMO_WALLET_VAULT: DemoWalletVaultEntry[] = [
  {
    id: 'credx-root',
    label: 'CredX Demo Wallet',
    role: 'seeded GeoOrbit · Pulse · Nexus operator',
    address: '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
    // eslint-disable-next-line
    privateKey: '0x0fd325870ae6e04af48d9273961e4fa7bb6059e2e9fe7c72c8567a2b76e5ae3a',
  },
  {
    id: 'demo-rtk',
    label: 'RTK Station Funder',
    role: 'GeoOrbit RTK station operator',
    address: '0xE30FeA79F25C645aeC5e6b6896d7C5A5Ec889b05',
    // eslint-disable-next-line
    privateKey: '0x0088d176bf52a4e76b803e3e63854482239e692d0ad585211a3dd29cfe54b14f',
  },
  {
    id: 'demo-iot',
    label: 'IoT Edge Fleet',
    role: 'Nexus edge (BLE) operator',
    address: '0xfeE5FC91765D3ba41f51e7da5051272eDDc5471E',
    // eslint-disable-next-line
    privateKey: '0x95649ae89a9a5026015ee53d94f697174fc439b1085ba96a8a99f6683388bc02',
  },
  {
    id: 'demo-band',
    label: 'Bandwidth Node',
    role: 'Pulse bandwidth node operator',
    address: '0x932AAbEca19d5b0c879A16853855e0A8cc971581',
    // eslint-disable-next-line
    privateKey: '0xb287b74baf07a5331c6b8dcedf685335030b4590cbf631e8a7e7f033d64f5c87',
  },
  {
    id: 'demo-field',
    label: 'Field Rover Unit',
    role: 'RTK rover field wallet',
    address: '0xB2309760B8E8A2f418953bf2A3f8E9FFDD555761',
    // eslint-disable-next-line
    privateKey: '0xb62a2fe9f0ecc1eb396f72211604ea21286868fbf9ff34f9e5611b6d2a6b9d02',
  },
  {
    id: 'demo-fleet',
    label: 'Fleet Console Ops',
    role: 'Enterprise fleet operator',
    address: '0x87129b7bd1f98659071716f615979eD883f1d087',
    // eslint-disable-next-line
    privateKey: '0x94e16537d33ece6bdbfec52b169d519033494d61dd4a501b355762f37650bf8c',
  },
];
