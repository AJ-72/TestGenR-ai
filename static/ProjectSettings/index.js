// Initialize Forge bridge
let bridge;

// Wait for bridge to be available
function initializeBridge() {
    return new Promise((resolve) => {
        if (typeof AP !== 'undefined' && AP.require) {
            bridge = AP.require('@forge/bridge');
            resolve();
        } else {
            setTimeout(() => initializeBridge().then(resolve), 100);
        }
    });
}

// Load data and initialize form
async function loadData() {
    try {
        await initializeBridge();
        
        const statuses = await bridge.invoke('getStatuses') || [];
        const config = await bridge.invoke('getConfig') || {};
        
        // Populate status dropdown
        const statusSelect = document.getElementById('triggerStatus');
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status.name;
            option.textContent = status.name;
            if (status.name === config.triggerStatus) {
                option.selected = true;
            }
            statusSelect.appendChild(option);
        });
        
        // Populate form fields
        if (config.accessKey) document.getElementById('accessKey').value = config.accessKey;
        if (config.secretKey) document.getElementById('secretKey').value = config.secretKey;
        if (config.region) document.getElementById('region').value = config.region;
        if (config.limit) document.getElementById('limit').value = config.limit;
        if (config.prompt) document.getElementById('prompt').value = config.prompt;
        
    } catch (error) {
        console.error('Failed to load data:', error);
        alert('Failed to load configuration');
    }
}

// Handle form submission
async function saveConfig(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        if (!bridge) {
            throw new Error('Bridge not available');
        }
        await bridge.invoke('saveConfig', data);
        alert('Configuration saved successfully!');
    } catch (error) {
        console.error('Failed to save config:', error);
        alert('Configuration cannot be saved - ' + error.message);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', loadData);
document.getElementById('configForm').addEventListener('submit', saveConfig);