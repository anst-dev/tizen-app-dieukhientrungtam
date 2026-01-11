/**
 * IframeScreenManager.js - Quản lý iframe cho các màn hình chi tiết
 *
 * Handles:
 * - Loading/unloading iframe screens
 * - Dynamic screen mapping from API data
 * - Screen mapping from tile STT to HTML files
 * - Bi-directional communication via postMessage
 * - Iframe lifecycle management
 */

/**
 * Default screen mapping from STT to file paths (fallback)
 * This will be overridden by dynamic mapping from API
 */
const DEFAULT_SCREEN_MAPPING = {
    4: 'screens/M4banDoDuongOng.html',
    5: 'screens/M5thongTinDiemChay.html',
    6: 'screens/M6thongTinLapDatMoiThayTheDongHo.html',
    7: 'screens/M7thongTinTienDoThiCongMangDuongOngCap12.html',
    8: 'screens/M8thongTinKetQuaGhiChiSoDongHo.html',
    9: 'screens/M9thongTinKetQuaCongNo.html',
    10: 'screens/M10thongTinTyLeThaThoatCacDMA.html',
    11: 'screens/M11thongTinChatLuongNuoc.html'
};

/**
 * Screen name patterns for auto-generating paths from API data
 * Maps screen STT to expected file name patterns
 */
const SCREEN_NAME_PATTERNS = {
    4: 'banDoDuongOng',
    5: 'thongTinDiemChay',
    6: 'thongTinLapDatMoiThayTheDongHo',
    7: 'thongTinTienDoThiCongMangDuongOngCap12',
    8: 'thongTinKetQuaGhiChiSoDongHo',
    9: 'thongTinKetQuaCongNo',
    10: 'thongTinTyLeThaThoatCacDMA',
    11: 'thongTinChatLuongNuoc'
};

/**
 * Dynamic screen mapping - will be updated from API
 */
let SCREEN_MAPPING = { ...DEFAULT_SCREEN_MAPPING };

/**
 * Message types for iframe communication
 */
const IframeMessageType = {
    // Parent -> Iframe
    THEME: 'theme',
    DATA: 'data',
    NAVIGATION: 'navigation',
    
    // Iframe -> Parent
    READY: 'ready',
    BACK: 'back',
    ERROR: 'error'
};

class IframeScreenManager {
    constructor() {
        // Container element for iframe
        this.container = null;

        // Current iframe element
        this.iframeElement = null;

        // Current loaded screen STT
        this.currentScreenSTT = null;

        // Is iframe loaded
        this.isLoaded = false;

        // Message handlers map
        this.messageHandlers = new Map();

        // Reference to parent container (detail-container)
        this.parentContainer = null;

        // Initialized flag
        this.isInitialized = false;

        // Iframe load timeout
        this.loadTimeout = 10000; // 10 seconds
    }

    /**
     * Initialize IframeScreenManager
     * @param {HTMLElement} container - Container element for iframe (optional)
     */
    init(container = null) {
        if (this.isInitialized) {
            return;
        }

        // Use provided container or find/create default
        this.parentContainer = container || document.getElementById('detail-container');
        
        if (!this.parentContainer) {
            this.log('Warning: Parent container not found');
        }

        // Setup message listener for iframe communication
        window.addEventListener('message', this.handleMessage.bind(this));

        // Register default message handlers
        this.registerDefaultHandlers();

        this.isInitialized = true;
        this.log('IframeScreenManager initialized');
    }

    /**
     * Destroy IframeScreenManager
     */
    destroy() {
        window.removeEventListener('message', this.handleMessage.bind(this));
        
        if (this.iframeElement) {
            this.closeScreen();
        }

        this.messageHandlers.clear();
        this.container = null;
        this.parentContainer = null;
        this.isInitialized = false;
        
        this.log('IframeScreenManager destroyed');
    }

    // ==================== Screen Loading ====================

    /**
     * Open a screen by STT number
     * @param {number|string} screenSTT - Screen STT number
     * @param {Object} params - Optional parameters to pass to iframe
     * @returns {Promise<boolean>}
     */
    async openScreen(screenSTT, params = {}) {
        const stt = parseInt(screenSTT, 10);
        
        // Check if screen exists in mapping
        if (!SCREEN_MAPPING[stt]) {
            this.log(`Screen not found for STT: ${stt}`);
            return false;
        }

        // Close current screen if any
        if (this.isLoaded) {
            await this.closeScreen();
        }

        return new Promise((resolve, reject) => {
            try {
                // Create iframe container
                this.createIframeContainer();

                // Create iframe element
                this.iframeElement = document.createElement('iframe');
                this.iframeElement.className = 'detail-screen-iframe';
                this.iframeElement.id = `iframe-screen-${stt}`;
                this.iframeElement.setAttribute('frameborder', '0');
                this.iframeElement.setAttribute('allowfullscreen', 'true');
                this.iframeElement.setAttribute('title', `Screen M${stt}`);

                // Set load timeout
                const timeoutId = setTimeout(() => {
                    this.log(`Iframe load timeout for screen ${stt}`);
                    reject(new Error('Iframe load timeout'));
                }, this.loadTimeout);

                // Handle iframe load
                this.iframeElement.onload = () => {
                    clearTimeout(timeoutId);
                    this.isLoaded = true;
                    this.currentScreenSTT = stt;

                    // Send initial data to iframe
                    this.sendInitialData(stt, params);

                    this.log(`Screen loaded: M${stt}`);
                    resolve(true);
                };

                // Handle iframe error
                this.iframeElement.onerror = (error) => {
                    clearTimeout(timeoutId);
                    this.log(`Iframe load error for screen ${stt}:`, error);
                    reject(error);
                };

                // Set iframe source
                this.iframeElement.src = SCREEN_MAPPING[stt];

                // Append iframe to container
                this.container.appendChild(this.iframeElement);

                // Show container
                this.showContainer();

            } catch (error) {
                this.log('Error opening screen:', error);
                reject(error);
            }
        });
    }

    /**
     * Close current screen
     * @returns {Promise<void>}
     */
    async closeScreen() {
        return new Promise(resolve => {
            if (!this.iframeElement) {
                resolve();
                return;
            }

            // Remove iframe
            if (this.iframeElement.parentNode) {
                this.iframeElement.parentNode.removeChild(this.iframeElement);
            }

            this.iframeElement = null;
            this.isLoaded = false;
            this.currentScreenSTT = null;

            // Hide and remove container
            this.hideContainer();

            this.log('Screen closed');
            resolve();
        });
    }

    /**
     * Reload current screen
     * @returns {Promise<boolean>}
     */
    async reloadScreen() {
        if (!this.currentScreenSTT) {
            return false;
        }

        const stt = this.currentScreenSTT;
        await this.closeScreen();
        return this.openScreen(stt);
    }

    // ==================== Container Management ====================

    /**
     * Create iframe container inside parent container
     * @private
     */
    createIframeContainer() {
        // Check if container already exists
        this.container = document.getElementById('iframe-container');
        
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'iframe-container';
            this.container.className = 'iframe-container';

            // Append to parent container (detail-container)
            if (this.parentContainer) {
                // Hide the widget grid
                const widgetGrid = this.parentContainer.querySelector('.widget-grid');
                if (widgetGrid) {
                    widgetGrid.style.display = 'none';
                }

                // Find detail-content or detail-wrapper
                const detailContent = this.parentContainer.querySelector('.detail-content');
                if (detailContent) {
                    detailContent.appendChild(this.container);
                } else {
                    this.parentContainer.appendChild(this.container);
                }
            } else {
                document.body.appendChild(this.container);
            }
        }

        this.container.style.display = 'block';
    }

    /**
     * Show iframe container
     * @private
     */
    showContainer() {
        if (this.container) {
            this.container.style.display = 'block';
            this.container.classList.add('active');
        }

        // Ensure parent container is visible
        if (this.parentContainer) {
            this.parentContainer.style.display = 'block';
            this.parentContainer.classList.add('active');
        }
    }

    /**
     * Hide iframe container
     * @private
     */
    hideContainer() {
        if (this.container) {
            this.container.classList.remove('active');
            this.container.style.display = 'none';

            // Remove container
            if (this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
            this.container = null;
        }

        // Show widget grid again if parent container exists
        if (this.parentContainer) {
            const widgetGrid = this.parentContainer.querySelector('.widget-grid');
            if (widgetGrid) {
                widgetGrid.style.display = '';
            }
        }
    }

    // ==================== State Queries ====================

    /**
     * Check if iframe is loaded
     * @returns {boolean}
     */
    getIsLoaded() {
        return this.isLoaded;
    }

    /**
     * Get current screen STT
     * @returns {number|null}
     */
    getCurrentScreenSTT() {
        return this.currentScreenSTT;
    }

    /**
     * Get iframe element
     * @returns {HTMLIFrameElement|null}
     */
    getIframeElement() {
        return this.iframeElement;
    }

    /**
     * Check if a screen exists in mapping
     * @param {number} stt
     * @returns {boolean}
     */
    hasScreen(stt) {
        return !!SCREEN_MAPPING[parseInt(stt, 10)];
    }

    // ==================== Communication ====================

    /**
     * Send message to iframe
     * @param {Object} message - Message object with type and data
     */
    sendMessage(message) {
        if (!this.iframeElement || !this.iframeElement.contentWindow) {
            this.log('Cannot send message: iframe not ready');
            return;
        }

        try {
            this.iframeElement.contentWindow.postMessage(message, '*');
            this.log('Message sent to iframe:', message);
        } catch (error) {
            this.log('Error sending message to iframe:', error);
        }
    }

    /**
     * Send initial data to iframe after load
     * @private
     */
    sendInitialData(screenSTT, params) {
        // Send theme configuration
        this.sendMessage({
            type: IframeMessageType.THEME,
            data: {
                mode: 'dark',
                primaryColor: '#38bdf8',
                fontSize: '16px'
            }
        });

        // Send screen data
        this.sendMessage({
            type: IframeMessageType.DATA,
            data: {
                screenSTT,
                params,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Handle incoming messages from iframe
     * @private
     */
    handleMessage(event) {
        // Validate message source if needed
        // For security, you might want to check event.origin

        const message = event.data;
        if (!message || !message.type) {
            return;
        }

        this.log('Message received from iframe:', message);

        // Get handler for message type
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
            handler(message, event.source);
        }
    }

    /**
     * Register message handler
     * @param {string} type - Message type
     * @param {Function} handler - Handler function
     */
    onMessage(type, handler) {
        if (typeof handler === 'function') {
            this.messageHandlers.set(type, handler);
        }
    }

    /**
     * Unregister message handler
     * @param {string} type - Message type
     * @param {Function} handler - Handler function (unused, for API consistency)
     */
    offMessage(type, handler) {
        this.messageHandlers.delete(type);
    }

    /**
     * Register default message handlers
     * @private
     */
    registerDefaultHandlers() {
        // Handle ready message from iframe
        this.onMessage(IframeMessageType.READY, (message) => {
            this.log(`Iframe ready: screen ${message.screenSTT}`);
        });

        // Handle back navigation request from iframe
        this.onMessage(IframeMessageType.BACK, async (message) => {
            this.log('Back navigation requested from iframe');
            
            // Dispatch event for LayerNavigationManager to handle
            window.dispatchEvent(new CustomEvent('iframeBack', {
                detail: { screenSTT: this.currentScreenSTT }
            }));

            // Or directly call back if layerNavigationManager is available
            if (window.layerNavigationManager) {
                await window.layerNavigationManager.back();
            }
        });

        // Handle error messages from iframe
        this.onMessage(IframeMessageType.ERROR, (message) => {
            this.log('Error from iframe:', message.error);
        });
    }

    // ==================== Dynamic Screen Mapping ====================

    /**
     * Update screen mapping from API data
     * @param {Array} displays - Array of display objects from API
     * @returns {Object} - Updated screen mapping
     */
    updateScreenMapping(displays) {
        if (!Array.isArray(displays) || displays.length === 0) {
            this.log('No displays provided, keeping current mapping');
            return SCREEN_MAPPING;
        }

        // Start with default mapping as base
        const newMapping = { ...DEFAULT_SCREEN_MAPPING };

        displays.forEach(display => {
            const stt = display.STT || display.stt;
            if (stt === undefined || stt === null) {
                return;
            }

            const numericStt = parseInt(stt, 10);
            
            // Skip M0 (map screen) - it doesn't use iframe
            if (numericStt === 0) {
                return;
            }

            // Try to get path from API data first
            let screenPath = display.DuongDanMacDinh || display.duongDan || display.screenPath;

            // If no path from API, try to generate from STT
            if (!screenPath) {
                screenPath = this.generateScreenPath(numericStt, display.TenManHinh);
            }

            // Validate path exists before adding
            if (screenPath) {
                newMapping[numericStt] = screenPath;
            }
        });

        // Update global mapping
        SCREEN_MAPPING = newMapping;

        this.log('Screen mapping updated:', SCREEN_MAPPING);

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('screenMappingUpdated', {
            detail: { mapping: SCREEN_MAPPING, displays }
        }));

        return SCREEN_MAPPING;
    }

    /**
     * Generate screen path from STT and optional screen name
     * @param {number} stt - Screen STT number
     * @param {string} screenName - Optional screen name from API
     * @returns {string|null} - Generated screen path or null
     */
    generateScreenPath(stt, screenName) {
        // First check if we have a pattern for this STT
        const pattern = SCREEN_NAME_PATTERNS[stt];
        if (pattern) {
            return `screens/M${stt}${pattern}.html`;
        }

        // Try to generate from screen name if provided
        if (screenName) {
            // Extract pattern from screen name (e.g., "M4: Bản đồ đường ống" -> "banDoDuongOng")
            const match = screenName.match(/M(\d+):\s*(.+)/);
            if (match) {
                const name = this.convertToFileName(match[2]);
                if (name) {
                    return `screens/M${stt}${name}.html`;
                }
            }
        }

        // Fallback to default mapping if exists
        if (DEFAULT_SCREEN_MAPPING[stt]) {
            return DEFAULT_SCREEN_MAPPING[stt];
        }

        this.log(`No screen path found for STT: ${stt}`);
        return null;
    }

    /**
     * Convert Vietnamese screen name to camelCase file name
     * @param {string} name - Vietnamese screen name
     * @returns {string} - camelCase file name
     */
    convertToFileName(name) {
        if (!name) return '';

        // Vietnamese character mapping
        const vietnameseMap = {
            'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
            'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
            'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
            'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
            'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
            'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
            'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
            'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
            'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
            'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
            'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
            'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
            'đ': 'd',
            'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
            'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
            'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
            'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
            'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
            'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
            'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
            'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
            'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
            'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
            'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
            'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
            'Đ': 'D'
        };

        // Remove Vietnamese diacritics
        let result = name.split('').map(char => vietnameseMap[char] || char).join('');

        // Split into words and convert to camelCase
        const words = result.split(/[\s,]+/).filter(word => word.length > 0);
        
        return words.map((word, index) => {
            const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
            if (cleanWord.length === 0) return '';
            
            if (index === 0) {
                return cleanWord.toLowerCase();
            }
            return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
        }).join('');
    }

    /**
     * Get current screen mapping
     * @returns {Object} - Current screen mapping
     */
    getScreenMapping() {
        return { ...SCREEN_MAPPING };
    }

    /**
     * Get available screen STTs from current mapping
     * @returns {Array<number>} - Array of available STT numbers
     */
    getAvailableScreens() {
        return Object.keys(SCREEN_MAPPING).map(key => parseInt(key, 10));
    }

    /**
     * Reset screen mapping to defaults
     */
    resetToDefaultMapping() {
        SCREEN_MAPPING = { ...DEFAULT_SCREEN_MAPPING };
        this.log('Screen mapping reset to defaults');
        
        window.dispatchEvent(new CustomEvent('screenMappingUpdated', {
            detail: { mapping: SCREEN_MAPPING, isReset: true }
        }));
    }

    /**
     * Add or update a single screen mapping
     * @param {number} stt - Screen STT number
     * @param {string} path - Screen file path
     */
    setScreenPath(stt, path) {
        const numericStt = parseInt(stt, 10);
        if (isNaN(numericStt)) {
            this.log(`Invalid STT: ${stt}`);
            return;
        }

        SCREEN_MAPPING[numericStt] = path;
        this.log(`Screen path set: M${numericStt} -> ${path}`);
    }

    /**
     * Remove a screen from mapping
     * @param {number} stt - Screen STT number
     */
    removeScreen(stt) {
        const numericStt = parseInt(stt, 10);
        if (SCREEN_MAPPING[numericStt]) {
            delete SCREEN_MAPPING[numericStt];
            this.log(`Screen removed: M${numericStt}`);
        }
    }

    /**
     * Get screen path for a specific STT with fallback
     * @param {number} stt - Screen STT number
     * @returns {string|null} - Screen path or null if not found
     */
    getScreenPath(stt) {
        const numericStt = parseInt(stt, 10);
        
        // First try dynamic mapping
        if (SCREEN_MAPPING[numericStt]) {
            return SCREEN_MAPPING[numericStt];
        }

        // Fallback to default mapping
        if (DEFAULT_SCREEN_MAPPING[numericStt]) {
            return DEFAULT_SCREEN_MAPPING[numericStt];
        }

        return null;
    }

    // ==================== Focus Management ====================

    /**
     * Focus the iframe
     */
    focusIframe() {
        if (this.iframeElement) {
            this.iframeElement.focus();
            this.log('Iframe focused');
        }
    }

    /**
     * Blur the iframe
     */
    blurIframe() {
        if (this.iframeElement) {
            this.iframeElement.blur();
            this.log('Iframe blurred');
        }
    }

    // ==================== Logging ====================

    /**
     * Log helper with prefix
     * @private
     */
    log(...args) {
        if (typeof Config !== 'undefined' && Config.log) {
            Config.log('debug', '[IframeScreenManager]', ...args);
        } else {
            console.log('[IframeScreenManager]', ...args);
        }
    }
}

// Create singleton instance
const iframeScreenManagerInstance = new IframeScreenManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        IframeScreenManager,
        iframeScreenManagerInstance,
        SCREEN_MAPPING,
        DEFAULT_SCREEN_MAPPING,
        SCREEN_NAME_PATTERNS,
        IframeMessageType
    };
} else {
    window.IframeScreenManager = IframeScreenManager;
    window.iframeScreenManager = iframeScreenManagerInstance;
    window.SCREEN_MAPPING = SCREEN_MAPPING;
    window.DEFAULT_SCREEN_MAPPING = DEFAULT_SCREEN_MAPPING;
    window.SCREEN_NAME_PATTERNS = SCREEN_NAME_PATTERNS;
}
