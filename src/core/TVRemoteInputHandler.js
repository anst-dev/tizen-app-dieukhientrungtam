/**
 * TVRemoteInputHandler.js - Single point of entry cho tất cả input events từ TV remote
 * 
 * Responsibilities:
 * - Capture và normalize tất cả keydown events
 * - Register Tizen hardware keys
 * - Delegate events đến đúng handler dựa trên current layer
 * - Prevent default cho navigation keys
 */

/**
 * Tizen-specific key codes
 * Reference: https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html
 */
const TIZEN_KEY_CODES = {
    // Back/Return key - Tizen specific
    BACK: 10009,
    
    // Media keys
    VOLUME_UP: 447,
    VOLUME_DOWN: 448,
    VOLUME_MUTE: 449,
    CHANNEL_UP: 427,
    CHANNEL_DOWN: 428,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    REWIND: 412,
    FAST_FORWARD: 417,
    
    // Color keys
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,
    
    // Info/Guide
    INFO: 457,
    GUIDE: 458,
    
    // Number keys (0-9) - same as web standard
    NUM_0: 48,
    NUM_1: 49,
    NUM_2: 50,
    NUM_3: 51,
    NUM_4: 52,
    NUM_5: 53,
    NUM_6: 54,
    NUM_7: 55,
    NUM_8: 56,
    NUM_9: 57
};

/**
 * Standard navigation key codes
 * Note: Arrow keys use standard web key codes (37-40) on Tizen TV
 * They do NOT need to be registered with tvinputdevice.registerKey()
 */
const NAVIGATION_KEY_CODES = {
    ARROW_UP: 38,
    ARROW_DOWN: 40,
    ARROW_LEFT: 37,
    ARROW_RIGHT: 39,
    ENTER: 13,
    ESCAPE: 27
};

/**
 * Key name to keyCode mapping for event.key handling
 * Tizen TV may send either keyCode or key name depending on model
 */
const KEY_NAME_MAP = {
    'ArrowUp': NAVIGATION_KEY_CODES.ARROW_UP,
    'ArrowDown': NAVIGATION_KEY_CODES.ARROW_DOWN,
    'ArrowLeft': NAVIGATION_KEY_CODES.ARROW_LEFT,
    'ArrowRight': NAVIGATION_KEY_CODES.ARROW_RIGHT,
    'Up': NAVIGATION_KEY_CODES.ARROW_UP,        // Some Tizen models use 'Up' instead of 'ArrowUp'
    'Down': NAVIGATION_KEY_CODES.ARROW_DOWN,
    'Left': NAVIGATION_KEY_CODES.ARROW_LEFT,
    'Right': NAVIGATION_KEY_CODES.ARROW_RIGHT,
    'Enter': NAVIGATION_KEY_CODES.ENTER,
    'Return': NAVIGATION_KEY_CODES.ENTER,       // Some remotes send 'Return' for OK/Enter
    'Escape': NAVIGATION_KEY_CODES.ESCAPE,
    'XF86Back': TIZEN_KEY_CODES.BACK,           // Tizen back key name
    'Back': TIZEN_KEY_CODES.BACK,
    '0': TIZEN_KEY_CODES.NUM_0,
    '1': TIZEN_KEY_CODES.NUM_1,
    '2': TIZEN_KEY_CODES.NUM_2,
    '3': TIZEN_KEY_CODES.NUM_3,
    '4': TIZEN_KEY_CODES.NUM_4,
    '5': TIZEN_KEY_CODES.NUM_5,
    '6': TIZEN_KEY_CODES.NUM_6,
    '7': TIZEN_KEY_CODES.NUM_7,
    '8': TIZEN_KEY_CODES.NUM_8,
    '9': TIZEN_KEY_CODES.NUM_9
};

/**
 * All navigation keys that should prevent default
 */
const PREVENT_DEFAULT_KEYS = [
    NAVIGATION_KEY_CODES.ARROW_UP,
    NAVIGATION_KEY_CODES.ARROW_DOWN,
    NAVIGATION_KEY_CODES.ARROW_LEFT,
    NAVIGATION_KEY_CODES.ARROW_RIGHT,
    NAVIGATION_KEY_CODES.ENTER,
    NAVIGATION_KEY_CODES.ESCAPE,
    TIZEN_KEY_CODES.BACK,
    TIZEN_KEY_CODES.VOLUME_UP,
    TIZEN_KEY_CODES.VOLUME_DOWN
];

/**
 * Keys to register on Tizen
 *
 * IMPORTANT NOTES:
 * 1. Arrow keys (Up, Down, Left, Right) use standard web key codes (37-40)
 *    and do NOT need to be registered. They work out of the box.
 * 2. Enter/OK key uses standard key code (13) and does NOT need registration.
 * 3. Back key (10009) works by default, no registration needed.
 *    We only need to preventDefault to avoid app exit.
 * 4. Number keys (0-9) use standard key codes (48-57) and do NOT need registration.
 *
 * Only special hardware keys (Volume, Media, Color) need to be registered
 * to prevent system from handling them and to receive them in our app.
 *
 * Reference: https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html
 */
const TIZEN_KEYS_TO_REGISTER = [
    // Volume keys - register to prevent system volume UI
    'VolumeUp',
    'VolumeDown',
    'VolumeMute',
    // Media keys
    'MediaPlay',
    'MediaPause',
    'MediaStop',
    // Color keys (Red, Green, Yellow, Blue buttons on remote)
    'ColorF0Red',
    'ColorF1Green',
    'ColorF2Yellow',
    'ColorF3Blue',
    // Info/Guide
    'Info'
    // NOTE: Arrow keys, Enter, Back, and Number keys do NOT need registration
    // They use standard web key codes and work automatically
];

class TVRemoteInputHandler {
    constructor() {
        // Reference to managers
        this.focusManager = null;
        this.layerNavigationManager = null;
        this.iframeScreenManager = null;

        // Is handler enabled
        this.isEnabled = true;

        // Is currently processing input
        this.isProcessing = false;

        // Input processing delay (debounce)
        this.inputDelay = 100; // ms

        // Custom key listeners
        this.keyListeners = new Map();

        // Bound event handlers (for removal)
        this.boundHandleKeyDown = null;
        this.boundHandleTizenKey = null;

        // Initialized flag
        this.isInitialized = false;
    }

    /**
     * Initialize TVRemoteInputHandler
     */
    init() {
        if (this.isInitialized) {
            return;
        }

        // Get references to managers
        this.focusManager = window.focusManager;
        this.layerNavigationManager = window.layerNavigationManager;
        this.iframeScreenManager = window.iframeScreenManager;

        // Initialize managers if needed
        if (this.focusManager && !this.focusManager.isInitialized) {
            this.focusManager.init();
        }
        if (this.layerNavigationManager && !this.layerNavigationManager.isInitialized) {
            this.layerNavigationManager.init();
        }
        if (this.iframeScreenManager && !this.iframeScreenManager.isInitialized) {
            this.iframeScreenManager.init();
        }

        // Link managers
        if (this.layerNavigationManager && this.iframeScreenManager) {
            this.layerNavigationManager.setIframeManager(this.iframeScreenManager);
        }

        // Register Tizen hardware keys
        this.registerTizenKeys();

        // Bind event handlers
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleTizenKey = this.handleTizenKey.bind(this);

        document.addEventListener('keydown', this.boundHandleKeyDown);

        // Listen for Tizen hardware key events
        if (this.isTizen()) {
            document.addEventListener('tizenhwkey', this.boundHandleTizenKey);
        }

        // Listen for iframe back events
        window.addEventListener('iframeBack', this.handleIframeBack.bind(this));

        this.isInitialized = true;
        this.log('TVRemoteInputHandler initialized');
    }

    /**
     * Destroy TVRemoteInputHandler
     */
    destroy() {
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        
        if (this.isTizen()) {
            document.removeEventListener('tizenhwkey', this.boundHandleTizenKey);
            this.unregisterTizenKeys();
        }

        window.removeEventListener('iframeBack', this.handleIframeBack.bind(this));

        this.keyListeners.clear();
        this.isInitialized = false;
        
        this.log('TVRemoteInputHandler destroyed');
    }

    // ==================== Key Registration ====================

    /**
     * Register Tizen hardware keys
     */
    registerTizenKeys() {
        if (!this.isTizen()) {
            this.log('Not a Tizen device, skipping key registration');
            return;
        }

        const tvInputDevice = window.tizen?.tvinputdevice;
        if (!tvInputDevice || typeof tvInputDevice.registerKey !== 'function') {
            this.log('Tizen tvinputdevice not available');
            return;
        }

        TIZEN_KEYS_TO_REGISTER.forEach(key => {
            try {
                tvInputDevice.registerKey(key);
                this.log(`Registered Tizen key: ${key}`);
            } catch (error) {
                this.log(`Failed to register Tizen key ${key}:`, error);
            }
        });
    }

    /**
     * Unregister Tizen hardware keys
     */
    unregisterTizenKeys() {
        if (!this.isTizen()) {
            return;
        }

        const tvInputDevice = window.tizen?.tvinputdevice;
        if (!tvInputDevice || typeof tvInputDevice.unregisterKey !== 'function') {
            return;
        }

        TIZEN_KEYS_TO_REGISTER.forEach(key => {
            try {
                tvInputDevice.unregisterKey(key);
            } catch (error) {
                this.log(`Failed to unregister Tizen key ${key}:`, error);
            }
        });
    }

    // ==================== Event Handlers ====================

    /**
     * Handle standard keydown events
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        // CRITICAL FIX: preventDefault for Back key IMMEDIATELY, BEFORE any other checks
        // This prevents Tizen from exiting the app when isProcessing=true or isEnabled=false
        if (event.keyCode === TIZEN_KEY_CODES.BACK || event.keyCode === 10009) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!this.isEnabled || this.isProcessing) {
            return;
        }

        // Prevent default for other navigation keys
        if (PREVENT_DEFAULT_KEYS.includes(event.keyCode) && event.keyCode !== TIZEN_KEY_CODES.BACK) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Normalize key event
        const normalizedKey = this.normalizeKeyCode(event);

        // Process key
        this.processKey(normalizedKey);
    }

    /**
     * Handle Tizen hardware key events
     * @param {Event} event - Tizen hardware key event
     */
    handleTizenKey(event) {
        if (!this.isEnabled || this.isProcessing) {
            return;
        }

        event.preventDefault();

        const normalizedKey = {
            key: event.keyName,
            keyCode: this.getTizenKeyCode(event.keyName),
            originalEvent: event
        };

        this.processKey(normalizedKey);
    }

    /**
     * Handle back event from iframe
     * @param {CustomEvent} event
     */
    async handleIframeBack(event) {
        this.log('Handling iframe back event');
        await this.handleBackKey();
    }

    /**
     * Process normalized key
     * @param {Object} normalizedKey
     */
    async processKey(normalizedKey) {
        this.isProcessing = true;

        try {
            // Check for custom listeners first
            const customHandler = this.keyListeners.get(normalizedKey.key) || 
                                  this.keyListeners.get(String(normalizedKey.keyCode));
            
            if (customHandler) {
                const handled = customHandler(normalizedKey);
                if (handled) {
                    return;
                }
            }

            // Handle based on key type
            switch (normalizedKey.keyCode) {
                // Navigation arrows
                case NAVIGATION_KEY_CODES.ARROW_UP:
                    this.handleArrowKey('up');
                    break;
                case NAVIGATION_KEY_CODES.ARROW_DOWN:
                    this.handleArrowKey('down');
                    break;
                case NAVIGATION_KEY_CODES.ARROW_LEFT:
                    this.handleArrowKey('left');
                    break;
                case NAVIGATION_KEY_CODES.ARROW_RIGHT:
                    this.handleArrowKey('right');
                    break;

                // Enter/OK
                case NAVIGATION_KEY_CODES.ENTER:
                    await this.handleEnterKey();
                    break;

                // Back
                case NAVIGATION_KEY_CODES.ESCAPE:
                case TIZEN_KEY_CODES.BACK:
                    await this.handleBackKey();
                    break;

                // Volume (for map zoom)
                case TIZEN_KEY_CODES.VOLUME_UP:
                    this.handleVolumeKey(1);
                    break;
                case TIZEN_KEY_CODES.VOLUME_DOWN:
                    this.handleVolumeKey(-1);
                    break;

                // Number keys for quick navigation
                default:
                    if (normalizedKey.keyCode >= 48 && normalizedKey.keyCode <= 57) {
                        const number = normalizedKey.keyCode - 48;
                        this.handleNumberKey(number);
                    }
                    break;
            }

        } finally {
            // Debounce input
            setTimeout(() => {
                this.isProcessing = false;
            }, this.inputDelay);
        }
    }

    // ==================== Key Handlers ====================

    /**
     * Handle arrow key navigation
     * @param {string} direction - 'up', 'down', 'left', 'right'
     */
    handleArrowKey(direction) {
        const currentLayerNum = this.layerNavigationManager?.getCurrentLayer();
        const focusManagerLayer = this.focusManager?.getCurrentLayer();
        
        // DEBUG: Log both layer values to diagnose mismatch
        console.log('[DEBUG] handleArrowKey:', {
            direction,
            layerNavManager_currentLayer: currentLayerNum,
            focusManager_currentLayer: focusManagerLayer,
            LAYER_MAP: LAYER.MAP,
            LAYER_CONTROL_PANEL: LAYER.CONTROL_PANEL,
            LAYER_DETAIL_SCREEN: LAYER.DETAIL_SCREEN
        });

        // FIX: Use focusManager.currentLayer as source of truth since App.js syncs it correctly
        // layerNavigationManager is not synced when App uses router.navigate()
        const currentLayerType = focusManagerLayer || 'dashboard';
        
        this.log(`Arrow ${direction} in layer type: ${currentLayerType} (layerNav: ${currentLayerNum})`);

        switch (currentLayerType) {
            case 'map':
                this.handleMapNavigation(direction);
                break;
            case 'dashboard':
                this.handleDashboardNavigation(direction);
                break;
            case 'detail':
                this.handleDetailNavigation(direction);
                break;
            default:
                // Fallback: if layer type unknown, try dashboard navigation
                console.warn('[DEBUG] Unknown layer type, falling back to dashboard navigation');
                this.handleDashboardNavigation(direction);
                break;
        }
    }

    /**
     * Handle Enter key
     */
    async handleEnterKey() {
        const currentLayer = this.layerNavigationManager?.getCurrentLayer() || LAYER.CONTROL_PANEL;

        this.log(`Enter in layer ${currentLayer}`);

        switch (currentLayer) {
            case LAYER.MAP:
                // Zoom in on map
                this.handleVolumeKey(1);
                break;

            case LAYER.CONTROL_PANEL:
                // Open selected screen
                const focusedElement = document.activeElement;
                if (focusedElement && focusedElement.classList.contains('screen-tile')) {
                    const stt = parseInt(focusedElement.getAttribute('data-stt'), 10);
                    
                    if (stt === 0) {
                        // M0 is map, navigate to map
                        if (window.app?.lockMapView) {
                            window.app.lockMapView();
                        }
                        await this.layerNavigationManager.pushLayer(LAYER.MAP);
                    } else if (this.iframeScreenManager?.hasScreen(stt)) {
                        // Open detail screen via iframe
                        await this.openDetailScreen(stt);
                    } else {
                        // Fallback to old system
                        window.dispatchEvent(new CustomEvent('openScreenDetail', {
                            detail: { stt }
                        }));
                    }
                }
                break;

            case LAYER.DETAIL_SCREEN:
                // Activate focused element in detail view
                const detailFocused = document.activeElement;
                if (detailFocused) {
                    detailFocused.click();
                }
                break;
        }
    }

    /**
     * Handle Back key
     */
    async handleBackKey() {
        const currentLayer = this.layerNavigationManager?.getCurrentLayer();

        this.log(`Back in layer ${currentLayer}`);

        try {
            // Use layer navigation manager for back navigation
            if (this.layerNavigationManager) {
                await this.layerNavigationManager.back();
            } else {
                // Fallback to old navigation
                window.dispatchEvent(new CustomEvent('navigateBack', {
                    detail: { to: 'dashboard' }
                }));
            }
        } catch (error) {
            this.log('Error in handleBackKey:', error);
            // Error logged, Back key was already preventDefault'd
            // so app won't exit even if error occurs
        }
    }

    /**
     * Handle Volume keys (for map zoom)
     * @param {number} direction - 1 for up, -1 for down
     */
    handleVolumeKey(direction) {
        const currentLayer = this.layerNavigationManager?.getCurrentLayer() || LAYER.MAP;

        if (currentLayer === LAYER.MAP) {
            // Zoom map
            const mapComponent = window.app?.mapFullscreen;
            if (mapComponent && typeof mapComponent.adjustZoom === 'function') {
                mapComponent.adjustZoom(direction);
            } else {
                // Fallback to direct map manipulation
                const map = mapComponent?.map || mapComponent?.getMap?.();
                if (map) {
                    const view = map.getView();
                    const currentZoom = view.getZoom();
                    view.animate({
                        zoom: currentZoom + direction,
                        duration: 300
                    });
                }
            }
        }
    }

    /**
     * Handle Number keys for quick navigation
     * @param {number} number - 0-9
     */
    handleNumberKey(number) {
        const currentLayer = this.layerNavigationManager?.getCurrentLayer() || LAYER.CONTROL_PANEL;

        if (currentLayer !== LAYER.CONTROL_PANEL) {
            return;
        }

        // Find and focus the screen tile with this STT
        const targetTile = document.querySelector(`.screen-tile[data-stt="${number}"]`);
        if (targetTile) {
            this.focusManager?.setFocus(targetTile);
            this.log(`Quick navigated to screen M${number}`);

            // If it's M0, auto-trigger enter after a short delay
            if (number === 0) {
                setTimeout(() => {
                    this.handleEnterKey();
                }, 100);
            }
        }
    }

    // ==================== Layer-specific Navigation ====================

    /**
     * Handle navigation in map layer
     * @param {string} direction
     */
    handleMapNavigation(direction) {
        const map = window.app?.mapFullscreen?.map;
        if (!map) return;

        const view = map.getView();
        const center = view.getCenter();
        const resolution = view.getResolution();
        const panDistance = resolution * 100;

        let newCenter = [...center];

        switch (direction) {
            case 'up':
                newCenter[1] += panDistance;
                break;
            case 'down':
                newCenter[1] -= panDistance;
                break;
            case 'left':
                newCenter[0] -= panDistance;
                break;
            case 'right':
                newCenter[0] += panDistance;
                break;
        }

        view.animate({
            center: newCenter,
            duration: 300
        });
    }

    /**
     * Handle navigation in dashboard layer
     * @param {string} direction
     */
    handleDashboardNavigation(direction) {
        console.log('[DEBUG] handleDashboardNavigation called:', {
            direction,
            hasFocusManager: !!this.focusManager,
            focusManagerCurrentLayer: this.focusManager?.getCurrentLayer()
        });
        
        // Use FocusManager for navigation
        if (this.focusManager) {
            const result = this.focusManager.moveFocus(direction);
            console.log('[DEBUG] FocusManager.moveFocus result:', result);
        } else {
            console.warn('[DEBUG] No FocusManager, trying NavigationManager fallback');
            // Fallback to NavigationManager
            const navigationManager = window.app?.navigationManager;
            if (navigationManager) {
                navigationManager.navigate(direction);
            }
        }
    }

    /**
     * Handle navigation in detail layer
     * @param {string} direction
     */
    handleDetailNavigation(direction) {
        // If iframe is loaded, we might want to forward the key
        if (this.iframeScreenManager?.getIsLoaded()) {
            // For now, just log - iframe handles its own navigation
            this.log(`Detail navigation: ${direction} (iframe loaded)`);
        } else {
            // Navigate within widgets
            if (this.focusManager) {
                this.focusManager.moveFocus(direction);
            }
        }
    }

    // ==================== Screen Management ====================

    /**
     * Open detail screen
     * @param {number} screenSTT
     */
    async openDetailScreen(screenSTT) {
        this.log(`Opening detail screen: M${screenSTT}`);

        try {
            // Save current focus state
            if (this.focusManager) {
                this.focusManager.saveFocusState('dashboard');
            }

            // Open screen via IframeScreenManager
            if (this.iframeScreenManager) {
                await this.iframeScreenManager.openScreen(screenSTT);
            }

            // Update layer state
            if (this.layerNavigationManager) {
                // Ensure layerHistory is initialized (safety check)
                if (!Array.isArray(this.layerNavigationManager.layerHistory)) {
                    this.layerNavigationManager.layerHistory = [LAYER.CONTROL_PANEL];
                }

                // Update current layer
                this.layerNavigationManager.currentLayer = LAYER.DETAIL_SCREEN;
                
                // Only push if DETAIL_SCREEN is not already the last item
                const lastLayer = this.layerNavigationManager.layerHistory[this.layerNavigationManager.layerHistory.length - 1];
                if (lastLayer !== LAYER.DETAIL_SCREEN) {
                    this.layerNavigationManager.layerHistory.push(LAYER.DETAIL_SCREEN);
                }
                
                if (this.focusManager) {
                    this.focusManager.setCurrentLayer('detail');
                }
            }

        } catch (error) {
            this.log('Error opening detail screen:', error);
        }
    }

    // ==================== Key Normalization ====================

    /**
     * Normalize key event to standard format
     * Handles both event.key (string) and event.keyCode (number) for cross-device compatibility
     * @param {KeyboardEvent} event
     * @returns {Object}
     */
    normalizeKeyCode(event) {
        let keyCode = event.keyCode;
        let key = event.key;

        // IMPORTANT: On some Tizen TV models, keyCode may be 0 or undefined
        // In this case, we need to use event.key to determine the correct keyCode
        if (!keyCode || keyCode === 0 || keyCode === 229) {
            // Try to get keyCode from KEY_NAME_MAP using event.key
            if (key && KEY_NAME_MAP[key] !== undefined) {
                keyCode = KEY_NAME_MAP[key];
                this.log(`Normalized key "${key}" to keyCode ${keyCode} (from KEY_NAME_MAP)`);
            }
        }

        // Handle Tizen Back key (might come as different key names)
        if (key === 'XF86Back' || key === 'Back' || keyCode === TIZEN_KEY_CODES.BACK) {
            keyCode = TIZEN_KEY_CODES.BACK;
            key = 'Back';
        }

        // Handle arrow keys that may come with different key names
        if (key === 'Up' || key === 'ArrowUp') {
            keyCode = NAVIGATION_KEY_CODES.ARROW_UP;
        } else if (key === 'Down' || key === 'ArrowDown') {
            keyCode = NAVIGATION_KEY_CODES.ARROW_DOWN;
        } else if (key === 'Left' || key === 'ArrowLeft') {
            keyCode = NAVIGATION_KEY_CODES.ARROW_LEFT;
        } else if (key === 'Right' || key === 'ArrowRight') {
            keyCode = NAVIGATION_KEY_CODES.ARROW_RIGHT;
        } else if (key === 'Enter' || key === 'Return') {
            keyCode = NAVIGATION_KEY_CODES.ENTER;
        }

        return {
            key,
            keyCode,
            originalEvent: event
        };
    }

    /**
     * Get Tizen key code from key name
     * @param {string} keyName
     * @returns {number}
     */
    getTizenKeyCode(keyName) {
        const keyMap = {
            'back': TIZEN_KEY_CODES.BACK,
            'VolumeUp': TIZEN_KEY_CODES.VOLUME_UP,
            'VolumeDown': TIZEN_KEY_CODES.VOLUME_DOWN,
            'VolumeMute': TIZEN_KEY_CODES.VOLUME_MUTE,
            'ChannelUp': TIZEN_KEY_CODES.CHANNEL_UP,
            'ChannelDown': TIZEN_KEY_CODES.CHANNEL_DOWN,
            'MediaPlay': TIZEN_KEY_CODES.PLAY,
            'MediaPause': TIZEN_KEY_CODES.PAUSE,
            'MediaStop': TIZEN_KEY_CODES.STOP,
            'MediaRewind': TIZEN_KEY_CODES.REWIND,
            'MediaFastForward': TIZEN_KEY_CODES.FAST_FORWARD,
            'Info': TIZEN_KEY_CODES.INFO,
            'ColorF0Red': TIZEN_KEY_CODES.RED,
            'ColorF1Green': TIZEN_KEY_CODES.GREEN,
            'ColorF2Yellow': TIZEN_KEY_CODES.YELLOW,
            'ColorF3Blue': TIZEN_KEY_CODES.BLUE
        };

        return keyMap[keyName] || 0;
    }

    // ==================== Listener Management ====================

    /**
     * Add custom key listener
     * @param {string} key - Key name or code
     * @param {Function} handler - (normalizedKey) => boolean
     */
    addKeyListener(key, handler) {
        if (typeof handler === 'function') {
            this.keyListeners.set(key, handler);
        }
    }

    /**
     * Remove custom key listener
     * @param {string} key - Key name or code
     * @param {Function} handler - (unused, for API consistency)
     */
    removeKeyListener(key, handler) {
        this.keyListeners.delete(key);
    }

    // ==================== State Management ====================

    /**
     * Enable input handling
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.log(`Input handling ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if running on Tizen
     * @returns {boolean}
     */
    isTizen() {
        return typeof window.tizen !== 'undefined' && window.tizen !== null;
    }

    // ==================== Logging ====================

    /**
     * Log helper with prefix
     * @private
     */
    log(...args) {
        if (typeof Config !== 'undefined' && Config.log) {
            Config.log('debug', '[TVRemoteInputHandler]', ...args);
        } else {
            console.log('[TVRemoteInputHandler]', ...args);
        }
    }
}

// Create singleton instance
const tvRemoteInputHandlerInstance = new TVRemoteInputHandler();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TVRemoteInputHandler,
        tvRemoteInputHandlerInstance,
        TIZEN_KEY_CODES,
        NAVIGATION_KEY_CODES,
        KEY_NAME_MAP
    };
} else {
    window.TVRemoteInputHandler = TVRemoteInputHandler;
    window.tvRemoteInputHandler = tvRemoteInputHandlerInstance;
    window.TIZEN_KEY_CODES = TIZEN_KEY_CODES;
    window.NAVIGATION_KEY_CODES = NAVIGATION_KEY_CODES;
    window.KEY_NAME_MAP = KEY_NAME_MAP;
}
