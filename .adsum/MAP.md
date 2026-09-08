# Workspace map — 52 file(s)

A map, not a substitute for reading. Paths are workspace-relative. Use read_file (with
start_line/end_line) or search_files on these paths instead of re-listing directories.

(root)
  .env.example
  .gitignore
  .markdownlint.json
  .markdownlintignore
  deployments.json
  DORAHACKS_SUBMISSION.md — doc
  hardhat.config.js
  package-lock.json
  package.json
  README.md — doc
  update-pragmas.js
.unode/
  rules.md — doc
contracts/core/
  CreditAttestationSBT.sol
  CreditScoreEngine.sol
  CredXHub.sol
  UndercollateralizedLendingPool.sol
contracts/core/tracks/
  AIRiskOracle.sol
  DePINDelegationPool.sol
  DePINInfrastructureHub.sol
  GamingEcosystemHub.sol
  GamingScholarshipVault.sol
  ReputationAMM.sol
  ReputationFlashLoan.sol
  ReputationYieldVault.sol
  RWAInvoiceFinancing.sol
  RWATreasuryYieldFund.sol
contracts/interfaces/
  IAttestationVerifier.sol
  ICredXHub.sol
  ILendingPool.sol
  IMockPriceOracle.sol
contracts/libraries/
  AttestcoinConstants.sol
contracts/mocks/
  MockAttestationOracle.sol
  MockDePINToken.sol
  MockERC20.sol
  MockERC721.sol
  MockFlashBorrower.sol
  MockGameItem.sol
  MockGameToken.sol
  MockPriceOracle.sol
frontend/
  app.js
  contracts.json
  index.html
  style.css
scripts/
  deploy.js
  generateProof.js
  test-e2e.js
test/
  CredX.test.js
  DeFi.test.js
  DePIN.test.js
  Gaming.test.js
  RWA.test.js
  Tracks.test.js
(walk stopped early: depth cap reached — use list_files for anything not listed)
