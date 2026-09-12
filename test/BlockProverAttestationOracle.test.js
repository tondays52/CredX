const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BlockProverAttestationOracle (real 0x0FD2 integration)", function () {
  let oracle, mockProver, mockChainInfo;
  let deployer, reaper;

  const CHAIN_KEY_SEPOLIA = 1;
  const HEIGHT = 1200000;
  const TX = ethers.solidityPacked(["bytes"], [ethers.randomBytes(64)]);

  const GOOD_ROOT = ethers.solidityPackedKeccak256(["uint256"], [7]);
  const BAD_ROOT = ethers.ZeroHash;

  function merkleProof(root) {
    return { root, siblings: [] };
  }

  const continuityProof = {
    lowerEndpointDigest: ethers.ZeroHash,
    roots: [],
  };

  before(async function () {
    [deployer, reaper] = await ethers.getSigners();

    mockProver = await (await ethers.getContractFactory("MockBlockProver")).deploy();
    mockChainInfo = await (await ethers.getContractFactory("MockChainInfo")).deploy();
    await mockChainInfo.setAttestedHeight(HEIGHT);

    oracle = await (
      await ethers.getContractFactory("BlockProverAttestationOracle")
    ).deploy(
      await mockProver.getAddress(),
      await mockChainInfo.getAddress()
    );
  });

  describe("precompile wiring", function () {
    it("defaults to the canonical 0x0FD2 / 0x0FD3 addresses when constructed empty", async function () {
      const canonical = await (
        await ethers.getContractFactory("BlockProverAttestationOracle")
      ).deploy(ethers.ZeroAddress, ethers.ZeroAddress);
      expect(await canonical.blockProverPrecompile()).to.equal(
        "0x0000000000000000000000000000000000000FD2"
      );
      expect((await canonical.chainInfoPrecompile()).toLowerCase()).to.equal(
        "0x0000000000000000000000000000000000000fd3"
      );
    });
  });

  describe("BlockProver verification (wraps 0x0FD2)", function () {
    it("returns true for a proof the precompile accepts", async function () {
      const ok = await oracle.verifySourceTransaction(
        CHAIN_KEY_SEPOLIA,
        HEIGHT,
        TX,
        merkleProof(GOOD_ROOT),
        continuityProof
      );
      expect(ok).to.equal(true);
    });

    it("returns false (does not revert) for an invalid proof", async function () {
      const ok = await oracle.verifySourceTransaction(
        CHAIN_KEY_SEPOLIA,
        HEIGHT,
        TX,
        merkleProof(BAD_ROOT),
        continuityProof
      );
      expect(ok).to.equal(false);
    });
  });

  describe("anchorVerifiedTransaction", function () {
    it("anchors a verified proof, stores it and emits ProofAnchored", async function () {
      const tx = await oracle
        .connect(reaper)
        .anchorVerifiedTransaction(
          CHAIN_KEY_SEPOLIA,
          HEIGHT,
          TX,
          merkleProof(GOOD_ROOT),
          continuityProof
        );

      await expect(tx)
        .to.emit(oracle, "ProofAnchored")
        .withArgs(CHAIN_KEY_SEPOLIA, HEIGHT, ethers.keccak256(TX), true);

      expect(await oracle.anchoredCount()).to.equal(1);
      expect(
        await oracle.isTxAnchored(CHAIN_KEY_SEPOLIA, HEIGHT, TX)
      ).to.equal(true);
    });

    it("reverts when the same source transaction is anchored twice (replay protection)", async function () {
      await expect(
        oracle.anchorVerifiedTransaction(
          CHAIN_KEY_SEPOLIA,
          HEIGHT,
          TX,
          merkleProof(GOOD_ROOT),
          continuityProof
        )
      ).to.be.revertedWith("BlockProverAttestationOracle: already anchored");
    });

    it("does not revert for a failed proof; it simply returns false", async function () {
      const freshTx = ethers.solidityPacked(["bytes"], [ethers.randomBytes(64)]);
      await expect(
        oracle.anchorVerifiedTransaction(
          CHAIN_KEY_SEPOLIA,
          HEIGHT,
          freshTx,
          merkleProof(BAD_ROOT),
          continuityProof
        )
      ).to.not.be.reverted;

      expect(
        await oracle.isTxAnchored(CHAIN_KEY_SEPOLIA, HEIGHT, freshTx)
      ).to.equal(false);
      expect(await oracle.anchoredCount()).to.equal(1);
    });
  });

  describe("ChainInfo reads (wraps 0x0FD3)", function () {
    it("lists supported chains", async function () {
      const chains = await oracle.supportedChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].chainKey).to.equal(1);
      expect(chains[0].chainId).to.equal(11155111);
    });

    it("reports supported / unknown chains", async function () {
      expect(await oracle.isSupportedChain(CHAIN_KEY_SEPOLIA)).to.equal(true);
      expect(await oracle.isSupportedChain(99)).to.equal(false);
    });

    it("exposes the latest attested height and attestation coverage", async function () {
      const [height, exists] = await oracle.latestAttestedHeight(CHAIN_KEY_SEPOLIA);
      expect(height).to.equal(HEIGHT);
      expect(exists).to.equal(true);

      expect(await oracle.isHeightAttested(CHAIN_KEY_SEPOLIA, HEIGHT)).to.equal(true);
      expect(await oracle.isHeightAttested(CHAIN_KEY_SEPOLIA, HEIGHT + 1)).to.equal(false);
    });
  });
});