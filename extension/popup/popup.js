document.addEventListener('DOMContentLoaded', async () => {
  const pointsValue = document.getElementById('pointsValue');
  const uptimeValue = document.getElementById('uptimeValue');
  const bandwidthValue = document.getElementById('bandwidthValue');
  const scoreValue = document.getElementById('scoreValue');
  const statusBadge = document.getElementById('statusBadge');
  const toggleNodeBtn = document.getElementById('toggleNodeBtn');
  const syncChainBtn = document.getElementById('syncChainBtn');
  const txStatus = document.getElementById('txStatus');

  const { ethers } = window;

  const RPC_URL = "http://127.0.0.1:8545";
  const CREDX_HUB_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; 
  const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; 

  let isNodeActive = false;
  let updateInterval = null;

  const initUI = async () => {
    const data = await chrome.storage.local.get(['isNodeActive', 'uptimeSeconds', 'bandwidthSharedMB', 'credXPoints']);
    isNodeActive = data.isNodeActive || false;
    
    updateDisplay(data);
    updateNodeState();
    
    if (!updateInterval) {
      updateInterval = setInterval(async () => {
        const newData = await chrome.storage.local.get(['uptimeSeconds', 'bandwidthSharedMB', 'credXPoints']);
        updateDisplay(newData);
      }, 1000);
    }

    await fetchCreditScore();
  };

  const updateDisplay = (data) => {
    pointsValue.innerText = (data.credXPoints || 0).toString();
    bandwidthValue.innerText = (data.bandwidthSharedMB || 0) + " MB";
    
    const totalSeconds = data.uptimeSeconds || 0;
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    uptimeValue.innerText = `${hours}:${minutes}:${seconds}`;

    syncChainBtn.disabled = (data.credXPoints || 0) === 0;
  };

  const updateNodeState = () => {
    if (isNodeActive) {
      statusBadge.innerText = "Connected";
      statusBadge.className = "badge connected";
      toggleNodeBtn.innerText = "Stop Node";
      toggleNodeBtn.className = "btn outline";
    } else {
      statusBadge.innerText = "Disconnected";
      statusBadge.className = "badge disconnected";
      toggleNodeBtn.innerText = "Start Node";
      toggleNodeBtn.className = "btn primary";
    }
  };

  const fetchCreditScore = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      
      const abi = [
        "function getBorrowerProfile(address borrower) external view returns (uint256 creditScore, uint256 totalBorrowed, uint256 totalRepaid, uint256 activeLoans, uint256 lastUpdate, address delegator)"
      ];
      
      const contract = new ethers.Contract(CREDX_HUB_ADDRESS, abi, wallet);
      const profile = await contract.getBorrowerProfile(wallet.address);
      scoreValue.innerText = profile.creditScore.toString();
    } catch (err) {
      console.log("Could not fetch score. Is local node running?", err);
    }
  };

  toggleNodeBtn.addEventListener('click', async () => {
    isNodeActive = !isNodeActive;
    await chrome.storage.local.set({ isNodeActive });
    updateNodeState();
  });

  syncChainBtn.addEventListener('click', async () => {
    txStatus.className = "tx-status hidden";
    syncChainBtn.innerText = "Syncing...";
    syncChainBtn.disabled = true;

    try {
      const data = await chrome.storage.local.get(['credXPoints']);
      const pointsToSync = data.credXPoints || 0;

      if (pointsToSync === 0) {
          throw new Error("No points to sync.");
      }

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

      const amount = ethers.parseEther(pointsToSync.toString()); 
      const timestamp = Math.floor(Date.now() / 1000);
      const eventId = ethers.hexlify(ethers.randomBytes(32));
      
      const proof = {
        borrower: wallet.address,
        amount: amount,
        timestamp: timestamp,
        eventId: eventId
      };

      const domain = {
        name: "CredX",
        version: "1",
        chainId: 31337, 
        verifyingContract: CREDX_HUB_ADDRESS
      };
      
      const types = {
        RepaymentProof: [
          { name: "borrower", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "eventId", type: "bytes32" }
        ]
      };
      
      const signature = await wallet.signTypedData(domain, types, proof);

      const abi = [
        "function submitRepaymentProof(tuple(address borrower, uint256 amount, uint256 timestamp, bytes32 eventId) proof, bytes signature) external"
      ];
      
      const contract = new ethers.Contract(CREDX_HUB_ADDRESS, abi, wallet);
      const tx = await contract.submitRepaymentProof(proof, signature);
      await tx.wait();

      await chrome.storage.local.set({ credXPoints: 0 });
      
      await fetchCreditScore();

      txStatus.innerText = "Synced successfully!";
      txStatus.className = "tx-status success";
    } catch (err) {
      console.error(err);
      txStatus.innerText = "Sync Failed: " + (err.reason || err.message);
      txStatus.className = "tx-status error";
    } finally {
      syncChainBtn.innerText = "Sync to Chain";
      syncChainBtn.disabled = false;
    }
  });

  initUI();
});
