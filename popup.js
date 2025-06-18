document.addEventListener('DOMContentLoaded', () => {
    const updateButton = document.getElementById('manual-update-btn');

    // Ask the content script for the current page's status
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (!currentTab) return;

        // Send a message to the content script to get its status
        chrome.tabs.sendMessage(currentTab.id, { type: 'GET_PAGE_STATUS' }, (response) => {
            // Check for errors (e.g., content script not injected yet)
            if (chrome.runtime.lastError) {
                console.warn("Could not connect to content script:", chrome.runtime.lastError.message);
                updateButton.disabled = true;
                updateButton.textContent = 'Go to a Steam Profile';
                return;
            }

            if (response && response.status === 'HAS_STEAM_ID') {
                updateButton.disabled = false; // Enable the button
                if (response.isCached) {
                    updateButton.textContent = 'Refresh Cached Data';
                } else {
                    // Data is fresh, so disable the button as it's not needed
                    updateButton.textContent = 'Data is Up-to-Date';
                    updateButton.disabled = true;
                }
            } else {
                // No Steam ID found on the page
                updateButton.disabled = true;
                updateButton.textContent = 'Go to a Steam Profile';
            }
        });
    });

    // Add click listener for the button (this logic remains the same)
    updateButton.addEventListener('click', () => {
        if (updateButton.disabled) return;

        updateButton.disabled = true;
        updateButton.textContent = 'Updating...';

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'FORCE_REFRESH' }, (response) => {
                if (chrome.runtime.lastError) {
                    updateButton.textContent = 'Error: Refresh page';
                    console.error(chrome.runtime.lastError.message);
                } else if (response && response.success) {
                    updateButton.textContent = 'Updated!';
                    setTimeout(() => window.close(), 1200);
                } else {
                    updateButton.textContent = 'Update Failed';
                }
            });
        });
    });
});