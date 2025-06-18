// An "Immediately Invoked Function Expression" to use async/await
(async () => {
  // --- Helper function to get the 64-bit Steam ID  ---
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

  // --- NEW: Helper function to get data from cache ---
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
          return cachedEntry.data; // Return the fresh data
        } else {
          console.log(`Cache expired for Steam ID: ${steamId64}. Fetching new data.`);
          // Optional: remove the expired entry
          await chrome.storage.local.remove([key]);
        }
      }
    } catch (error) {
      console.error("Error reading from cache:", error);
    }
    return null; // Return null if no cache, cache is expired, or an error occurs
  };

  // --- NEW: Helper function to set data in cache ---
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

  // --- Helper function to get FACEIT data ---
  const getFaceitData = async (steamId64) => {
    // 1. Try to get data from cache first
    const cachedData = await getCachedData(steamId64);
    if (cachedData) {
      return cachedData;
    }

    // 2. If not in cache, fetch from the API
    console.log(`Fetching fresh FACEIT data for Steam ID: ${steamId64}`);
    const proxyApiUrl = `https://faceitfinderextension.vercel.app/api/faceit-data?steamId=${steamId64}`;
    try {
      const response = await fetch(proxyApiUrl);
      if (!response.ok) {
        console.error("Proxy Server Error:", response.status, response.statusText);
        return null;
      }
      const playerData = await response.json();

      // 3. Save the newly fetched data to the cache
      if (playerData) {
        await setCachedData(steamId64, playerData);
      }

      return playerData;
    } catch (error) {
      console.error("Failed to fetch from proxy server:", error);
      return null;
    }
  };

  // --- Main logic  ---
  const steamId = getSteamID64();
  if (!steamId) {
    console.log("Steam ID not found on this page.");
    return;
  }

  const playerData = await getFaceitData(steamId);

  if (playerData && playerData.games && playerData.games.cs2 && playerData.games.cs2.skill_level) {
    const level = playerData.games.cs2.skill_level;
    const nickname = playerData.nickname;
    const faceitUrl = playerData.faceit_url.replace('{lang}', 'en');

    const targetElement = document.querySelector('.actual_persona_name');
    if (targetElement) {
      // Avoid adding the icon if it already exists
      if (document.getElementById(`faceit-link-${steamId}`)) return;

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
      link.id = `faceit-link-${steamId}`; // Add an ID to prevent duplicates
      link.appendChild(icon);

      targetElement.insertAdjacentElement('afterend', link);
    }
  } else {
    console.log(`No FACEIT CS2 data found for Steam ID: ${steamId}`);
  }
})();