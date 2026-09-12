chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isNodeActive: false,
    uptimeSeconds: 0,
    bandwidthSharedMB: 0,
    credXPoints: 0
  });
  chrome.alarms.create("nodeTick", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "nodeTick") {
    const data = await chrome.storage.local.get(['isNodeActive', 'uptimeSeconds', 'bandwidthSharedMB', 'credXPoints']);
    
    if (data.isNodeActive) {
      const additionalBandwidth = Math.floor(Math.random() * 5) + 1; // 1-5 MB // NOSONAR
      const additionalPoints = 10;
      
      await chrome.storage.local.set({
        uptimeSeconds: (data.uptimeSeconds || 0) + 60,
        bandwidthSharedMB: (data.bandwidthSharedMB || 0) + additionalBandwidth,
        credXPoints: (data.credXPoints || 0) + additionalPoints
      });
    }
  }
});
