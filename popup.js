document.addEventListener('DOMContentLoaded', () => {
    const updateButton = document.getElementById('manual-update-btn');
    const eloToggle = document.getElementById('elo-toggle');

    // --- Main function to update the popup's state ---
    const updatePopupState = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (!currentTab) return;

            // Ask the content script for its status
            chrome.tabs.sendMessage(currentTab.id, { type: 'GET_PAGE_STATUS' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("Could not connect to content script:", chrome.runtime.lastError.message);
                    updateButton.disabled = true;
                    updateButton.textContent = 'Go to a Steam Profile';
                    return;
                }

                if (response && response.status === 'HAS_STEAM_ID') {
                    updateButton.disabled = false;
                    if (response.isCached) {
                        updateButton.textContent = 'Refresh Cached Data';
                    } else {
                        updateButton.textContent = 'Data is Up-to-Date';
                        updateButton.disabled = true;
                    }
                } else {
                    updateButton.disabled = true;
                    updateButton.textContent = 'Go to a Steam Profile';
                }
            });
        });
    };

    // --- Load saved ELO toggle setting ---
    chrome.storage.sync.get(['showElo'], (result) => {
        eloToggle.checked = !!result.showElo;
    });

    // --- Event Listeners ---

    // Save setting when toggle is changed
    eloToggle.addEventListener('change', () => {
        const showElo = eloToggle.checked;
        chrome.storage.sync.set({ showElo: showElo }, () => {
            // Tell the active tab that the setting has changed so it can update the view
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTING_CHANGED' });
                }
            });
        });
    });

    // Manual update button click
    updateButton.addEventListener('click', () => {
        if (updateButton.disabled) return;
        updateButton.disabled = true;
        updateButton.textContent = 'Updating...';

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'FORCE_REFRESH' }, (response) => {
                if (chrome.runtime.lastError) {
                    updateButton.textContent = 'Error: Refresh page';
                } else if (response && response.success) {
                    updateButton.textContent = 'Updated!';
                    setTimeout(() => window.close(), 1200);
                } else {
                    updateButton.textContent = 'Update Failed';
                }
            });
        });
    });

    // --- Initial setup ---
    updatePopupState();
});