// An "Immediately Invoked Function Expression" to use async/await
(async () => {
  let isDataFromCache = false;
  let showEloSetting = false;
  let lastPlayerData = null; // Store the last fetched player data

  // --- Helper function to get the 64-bit Steam ID ---
  const getSteamID64 = () => {
    const url = window.location.href;
    const profileMatch = url.match(/steamcommunity\.com\/profiles\/(\d{17})/);
    if (profileMatch && profileMatch[1]) return profileMatch[1];
    const pageSource = document.documentElement.innerHTML;
    const idMatch = pageSource.match(/"steamid":"(\d{17})"/);
    if (idMatch && idMatch[1]) return idMatch[1];
    return null;
  };

  // --- Caching functions (no changes) ---
  const getCachedData = async (steamId64) => {
    try {
      const key = `faceit_${steamId64}`;
      const result = await chrome.storage.local.get([key]);
      const cachedEntry = result[key];
      if (cachedEntry) {
        const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;
        if (Date.now() - cachedEntry.timestamp < twentyFourHoursInMillis) {
          return cachedEntry.data;
        }
        await chrome.storage.local.remove([key]);
      }
    } catch (error) { console.error("Error reading from cache:", error); }
    return null;
  };
  const setCachedData = async (steamId64, data) => {
    try {
      const key = `faceit_${steamId64}`;
      await chrome.storage.local.set({ [key]: { data: data, timestamp: Date.now() } });
    } catch (error) { console.error("Error saving to cache:", error); }
  };

  // --- API fetching functions ---
  const fetchFromApi = async (steamId64) => {
    console.log(`Fetching fresh FACEIT data for Steam ID: ${steamId64}`);
    const proxyApiUrl = `https://faceitfinderextension.vercel.app/api/faceit-data?steamId=${steamId64}`;
    try {
      const response = await fetch(proxyApiUrl);
      if (!response.ok) return null;
      const playerData = await response.json();
      if (playerData) {
        await setCachedData(steamId64, playerData);
        isDataFromCache = false;
        lastPlayerData = playerData; // Store fresh data
      }
      return playerData;
    } catch (error) { return null; }
  };
  const getFaceitData = async (steamId64) => {
    const cachedData = await getCachedData(steamId64);
    if (cachedData) {
      isDataFromCache = true;
      lastPlayerData = cachedData; // Store cached data
      return cachedData;
    }
    return await fetchFromApi(steamId64);
  };

  // --- UPDATED: Function to display the FACEIT info on the page ---
  const displayFaceitInfo = (steamId, playerData) => {
    const containerId = `faceit-container-${steamId}`;
    const existingContainer = document.getElementById(containerId);
    if (existingContainer) existingContainer.remove();

    if (playerData && playerData.games && playerData.games.cs2 && playerData.games.cs2.skill_level) {
      const { skill_level, faceit_elo } = playerData.games.cs2;
      const { nickname, faceit_url } = playerData;
      const targetElement = document.querySelector('.actual_persona_name');
      if (!targetElement) return;

      // Create a container for the icon and ELO
      const container = document.createElement('div');
      container.id = containerId;
      container.style.display = 'inline-flex';
      container.style.alignItems = 'center';
      container.style.marginLeft = '8px';
      container.style.verticalAlign = 'middle';

      // Create the icon link
      const icon = document.createElement('img');
      icon.src = chrome.runtime.getURL(`images/faceit${skill_level}.png`);
      icon.title = `FACEIT Level ${skill_level} (${nickname})`;
      icon.style.width = '24px';
      icon.style.height = '24px';
      const link = document.createElement('a');
      link.href = faceit_url.replace('{lang}', 'en');
      link.target = '_blank';
      link.appendChild(icon);
      container.appendChild(link);

      // Create and add the ELO text if the setting is enabled
      if (showEloSetting && faceit_elo) {
        const eloSpan = document.createElement('span');
        eloSpan.textContent = `(${faceit_elo})`;
        eloSpan.style.marginLeft = '6px';
        eloSpan.style.fontSize = '14px';
        eloSpan.style.color = '#c7d5e0'; // Steam light text color
        eloSpan.style.fontWeight = 'normal';
        container.appendChild(eloSpan);
      }

      targetElement.insertAdjacentElement('afterend', container);
    }
  };

  // --- Main logic ---
  const steamId = getSteamID64();
  if (steamId) {
    // Load settings first
    const settings = await chrome.storage.sync.get(['showElo']);
    showEloSetting = !!settings.showElo;
    // Then get data and display
    const playerData = await getFaceitData(steamId);
    displayFaceitInfo(steamId, playerData);
  }

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_STATUS') {
      sendResponse({ status: getSteamID64() ? 'HAS_STEAM_ID' : 'NO_STEAM_ID', isCached: isDataFromCache });
      return true;
    }
    if (message.type === 'FORCE_REFRESH') {
      const currentSteamId = getSteamID64();
      if (currentSteamId) {
        (async () => {
          const newPlayerData = await fetchFromApi(currentSteamId);
          displayFaceitInfo(currentSteamId, newPlayerData);
          sendResponse({ success: true });
        })();
        return true;
      }
    }
    if (message.type === 'SETTING_CHANGED') {
      const currentSteamId = getSteamID64();
      if (currentSteamId && lastPlayerData) {
        (async () => {
          const settings = await chrome.storage.sync.get(['showElo']);
          showEloSetting = !!settings.showElo;
          displayFaceitInfo(currentSteamId, lastPlayerData); // Re-render with new setting
        })();
      }
    }
  });
})();