// An "Immediately Invoked Function Expression" to use async/await
(async () => {
  let isDataFromCache = false; // NEW: Variable to track data source

  // --- Helper function to get the 64-bit Steam ID (this stays the same) ---
  const getSteamID64 = () => {
    const url = window.location.href;
    const profileMatch = url.match(/steamcommunity\.com\/profiles\/(\d{17})/);
    if (profileMatch && profileMatch[1]) {
      return profileMatch[1];
    }
    const pageSource = document.documentElement.innerHTML;
    const idMatch = pageSource.match(/"steamid":"(\d{17})"/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
    return null;
  };

  // --- Helper function to get data from cache (this stays the same) ---
  const getCachedData = async (steamId64) => {
    try {
      const key = `faceit_${steamId64}`;
      const result = await chrome.storage.local.get([key]);
      const cachedEntry = result[key];

      if (cachedEntry) {
        const now = Date.now();
        const cacheAge = now - cachedEntry.timestamp;
        const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;

        if (cacheAge < twentyFourHoursInMillis) {
          console.log(`Using cached FACEIT data for Steam ID: ${steamId64}`);
          return cachedEntry.data;
        } else {
          console.log(`Cache expired for Steam ID: ${steamId64}.`);
          await chrome.storage.local.remove([key]);
        }
      }
    } catch (error) {
      console.error("Error reading from cache:", error);
    }
    return null;
  };

  // --- Helper function to set data in cache (this stays the same) ---
  const setCachedData = async (steamId64, data) => {
    try {
      const key = `faceit_${steamId64}`;
      const cacheEntry = {
        data: data,
        timestamp: Date.now(),
      };
      await chrome.storage.local.set({ [key]: cacheEntry });
      console.log(`Saved FACEIT data to cache for Steam ID: ${steamId64}`);
    } catch (error) {
      console.error("Error saving to cache:", error);
    }
  };

  // --- Helper function to fetch data directly from the API ---
  const fetchFromApi = async (steamId64) => {
    console.log(`Fetching fresh FACEIT data for Steam ID: ${steamId64}`);
    const proxyApiUrl = `https://faceitfinderextension.vercel.app/api/faceit-data?steamId=${steamId64}`;
    try {
      const response = await fetch(proxyApiUrl);
      if (!response.ok) {
        console.error("Proxy Server Error:", response.status, response.statusText);
        return null;
      }
      const playerData = await response.json();
      if (playerData) {
        await setCachedData(steamId64, playerData);
      }
      isDataFromCache = false; // Mark data as fresh
      return playerData;
    } catch (error) {
      console.error("Failed to fetch from proxy server:", error);
      return null;
    }
  };

  // --- Helper function to get FACEIT data (uses cache) ---
  const getFaceitData = async (steamId64) => {
    const cachedData = await getCachedData(steamId64);
    if (cachedData) {
      isDataFromCache = true; // Mark data as from cache
      return cachedData;
    }
    return await fetchFromApi(steamId64);
  };

  // --- Function to display the FACEIT icon on the page ---
  const displayFaceitIcon = (steamId, playerData) => {
    const existingLink = document.getElementById(`faceit-link-${steamId}`);
    if (existingLink) {
      existingLink.remove();
    }

    if (playerData && playerData.games && playerData.games.cs2 && playerData.games.cs2.skill_level) {
      const level = playerData.games.cs2.skill_level;
      const nickname = playerData.nickname;
      const faceitUrl = playerData.faceit_url.replace('{lang}', 'en');
      const targetElement = document.querySelector('.actual_persona_name');
      if (targetElement) {
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL(`images/faceit${level}.png`);
        icon.title = `FACEIT Level ${level} (${nickname})`;
        icon.style.width = '24px';
        icon.style.height = '24px';
        icon.style.marginLeft = '8px';
        icon.style.verticalAlign = 'middle';
        const link = document.createElement('a');
        link.href = faceitUrl;
        link.target = '_blank';
        link.id = `faceit-link-${steamId}`;
        link.appendChild(icon);
        targetElement.insertAdjacentElement('afterend', link);
      }
    } else {
      console.log(`No FACEIT CS2 data found for Steam ID: ${steamId}`);
    }
  };

  // --- Main logic ---
  const steamId = getSteamID64();
  if (steamId) {
    const playerData = await getFaceitData(steamId);
    displayFaceitIcon(steamId, playerData);
  } else {
    console.log("Steam ID not found on this page.");
  }

  // --- UPDATED: Listen for messages from the popup ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // The popup is asking for the page's status
    if (message.type === 'GET_PAGE_STATUS') {
      const currentSteamId = getSteamID64();
      if (currentSteamId) {
        sendResponse({
          status: 'HAS_STEAM_ID',
          isCached: isDataFromCache // Report if the current data is from cache
        });
      } else {
        sendResponse({ status: 'NO_STEAM_ID' });
      }
      return true; // Keep message channel open for async response
    }

    // The popup is asking for a forced refresh
    if (message.type === 'FORCE_REFRESH') {
      const currentSteamId = getSteamID64();
      if (currentSteamId) {
        (async () => {
          const newPlayerData = await fetchFromApi(currentSteamId); // This now correctly sets isDataFromCache to false
          displayFaceitIcon(currentSteamId, newPlayerData);
          sendResponse({ success: true });
        })();
        return true; // Indicates that the response is sent asynchronously
      } else {
        sendResponse({ success: false, error: "No SteamID found on page." });
      }
    }
  });

})();