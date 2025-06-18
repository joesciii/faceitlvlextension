document.addEventListener('DOMContentLoaded', () => {
    const updateButton = document.getElementById('manual-update-btn');

    // Check the current tab to see if it's a valid Steam profile
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && (currentTab.url.includes('steamcommunity.com/id/') || currentTab.url.includes('steamcommunity.com/profiles/'))) {
            updateButton.disabled = false;
            updateButton.textContent = 'Get Manual Update';
        } else {
            updateButton.disabled = true;
            updateButton.textContent = 'Go to a Steam Profile';
        }
    });

    // Add click listener for the button
    updateButton.addEventListener('click', () => {
        updateButton.disabled = true;
        updateButton.textContent = 'Updating...';

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            // Send a message to the content script in the active tab
            chrome.tabs.sendMessage(tabs[0].id, { type: 'FORCE_REFRESH' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Handle cases where the content script isn't ready
                    updateButton.textContent = 'Error: Refresh page';
                    console.error(chrome.runtime.lastError.message);
                } else if (response && response.success) {
                    updateButton.textContent = 'Updated!';
                    // Close the popup after a short delay for better UX
                    setTimeout(() => window.close(), 1200);
                } else {
                    updateButton.textContent = 'Update Failed';
                }
            });
        });
    });
});