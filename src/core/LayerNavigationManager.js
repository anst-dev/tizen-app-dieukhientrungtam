/**
 * LayerNavigationManager.js - Quản lý navigation giữa các layers
 * 
 * Điều phối chuyển đổi giữa 3 layers:
 * - Layer 1 (MAP): Bản đồ fullscreen
 * - Layer 2 (DASHBOARD): Control panel với screen tiles
 * - Layer 3 (DETAIL): Màn hình chi tiết trong iframe
 * 
 * Coordinate với FocusManager để save/restore focus khi chuyển layer.
 */

/**
 * Layer constants
 */
const LAYER = {
    MAP: 1,
    CONTROL_PANEL: 2,
    DETAIL_SCREEN: 3
};

/**
 * Layer type mapping
 */
const LAYER_TO_TYPE = {
    [LAYER.MAP]: 'map',
    [LAYER.CONTROL_PANEL]: 'dashboard',
    [LAYER.DETAIL_SCREEN]: 'detail'
};

/**
 * Transition states
 */
const TransitionState = {
    IDLE: 'idle',
    SAVING_FOCUS: 'saving-focus',
    HIDING: 'hiding',
    SHOWING: 'showing',
    RESTORING_FOCUS: 'restoring-focus',
    COMPLETE: 'complete'
};

class LayerNavigationManager {
    constructor() {
        // Current active layer
        this.currentLayer = LAYER.MAP;

        // Layer history stack for back navigation
        this.layerHistory = [];

        // Current transition state
        this.transitionState = TransitionState.IDLE;

        // Is currently transitioning
        this.isTransitioning = false;

        // Layer change callbacks
        this.layerChangeCallbacks = [];

        // Reference to FocusManager
        this.focusManager = null;

        // Reference to IframeScreenManager
        this.iframeManager = null;

        // Transition animation duration (ms)
        this.transitionDuration = 300;

        // Initialized flag
        this.isInitialized = false;
    }

    /**
     * Initialize LayerNavigationManager
     */
    init() {
        if (this.isInitialized) {
            return;
        }

        // Get reference to FocusManager
        this.focusManager = window.focusManager || new FocusManager();
        if (!this.focusManager.isInitialized) {
            this.focusManager.init();
        }

        // Set initial layer
        this.currentLayer = LAYER.MAP;
        this.layerHistory = [LAYER.MAP];
        this.focusManager.setCurrentLayer(LAYER_TO_TYPE[LAYER.MAP]);

        // Get transition duration from Config if available
        if (typeof Config !== 'undefined' && Config.LAYOUT && Config.LAYOUT.TRANSITION_DURATION) {
            this.transitionDuration = Config.LAYOUT.TRANSITION_DURATION;
        }

        this.isInitialized = true;
        this.log('LayerNavigationManager initialized');
    }

    /**
     * Destroy LayerNavigationManager
     */
    destroy() {
        this.layerHistory = [];
        this.layerChangeCallbacks = [];
        this.transitionState = TransitionState.IDLE;
        this.isTransitioning = false;
        this.isInitialized = false;
        this.log('LayerNavigationManager destroyed');
    }

    // ==================== Layer Transition ====================

    /**
     * Push a new layer onto the stack and transition to it
     * @param {number} layer - LAYER constant
     * @param {Object} params - Optional transition params
     * @returns {Promise<boolean>}
     */
    async pushLayer(layer, params = {}) {
        if (this.isTransitioning) {
            this.log('Transition already in progress, ignoring pushLayer');
            return false;
        }

        if (layer === this.currentLayer) {
            this.log('Already on target layer, ignoring pushLayer');
            return false;
        }

        // Validate transition
        if (!this.canTransition(this.currentLayer, layer)) {
            this.log(`Cannot transition from ${this.currentLayer} to ${layer}`);
            return false;
        }

        return this.performTransition(this.currentLayer, layer, params);
    }

    /**
     * Pop current layer and return to previous layer
     * @returns {Promise<boolean>}
     */
    async popLayer() {
        if (this.isTransitioning) {
            this.log('Transition already in progress, ignoring popLayer');
            return false;
        }

        // SAFETY CHECK: Ensure layerHistory is initialized
        if (!Array.isArray(this.layerHistory)) {
            this.layerHistory = [this.currentLayer || LAYER.MAP];
        }

        if (this.layerHistory.length <= 1) {
            this.log('No previous layer to pop to');
            // At root layer (MAP), might want to exit app on Tizen
            this.handleExitApp();
            return false;
        }

        // Get previous layer with safety check
        const previousLayerIndex = this.layerHistory.length - 2;
        const previousLayer = this.layerHistory[previousLayerIndex];
        
        if (previousLayer === undefined) {
            this.log('previousLayer is undefined at index', previousLayerIndex);
            return false;
        }
        
        return this.performTransition(this.currentLayer, previousLayer, { isBack: true });
    }

    /**
     * Perform the actual transition between layers
     * @private
     */
    async performTransition(fromLayer, toLayer, params = {}) {
        this.isTransitioning = true;
        const fromType = LAYER_TO_TYPE[fromLayer];
        const toType = LAYER_TO_TYPE[toLayer];

        try {
            // Step 1: Save focus state
            this.transitionState = TransitionState.SAVING_FOCUS;
            this.focusManager.saveFocusState(fromType);

            // Step 2: Hide current layer
            this.transitionState = TransitionState.HIDING;
            await this.hideLayer(fromLayer);

            // Step 3: Handle iframe for detail layer
            if (fromLayer === LAYER.DETAIL_SCREEN && this.iframeManager) {
                await this.iframeManager.closeScreen();
            }

            if (toLayer === LAYER.DETAIL_SCREEN && params.screenSTT && this.iframeManager) {
                await this.iframeManager.openScreen(params.screenSTT);
            }

            // Step 4: Show target layer
            this.transitionState = TransitionState.SHOWING;
            await this.showLayer(toLayer);

            // Step 5: Update history
            if (params.isBack) {
                this.layerHistory.pop();
            } else {
                this.layerHistory.push(toLayer);
            }

            // Step 6: Update current layer
            const previousLayer = this.currentLayer;
            this.currentLayer = toLayer;
            this.focusManager.setCurrentLayer(toType);

            // Step 7: Restore focus
            this.transitionState = TransitionState.RESTORING_FOCUS;
            if (params.isBack) {
                this.focusManager.restoreFocusState(toType);
            } else {
                this.focusManager.focusFirstElement(toType);
            }

            // Step 8: Notify callbacks
            this.transitionState = TransitionState.COMPLETE;
            this.notifyLayerChange(previousLayer, toLayer, params);

            this.log(`Transition complete: ${fromType} -> ${toType}`);
            return true;

        } catch (error) {
            this.log('Transition error:', error);
            return false;

        } finally {
            this.isTransitioning = false;
            this.transitionState = TransitionState.IDLE;
        }
    }

    /**
     * Check if transition between layers is valid
     * @param {number} fromLayer
     * @param {number} toLayer
     * @returns {boolean}
     */
    canTransition(fromLayer, toLayer) {
        // Define valid transitions
        const validTransitions = {
            [LAYER.MAP]: [LAYER.CONTROL_PANEL],
            [LAYER.CONTROL_PANEL]: [LAYER.MAP, LAYER.DETAIL_SCREEN],
            [LAYER.DETAIL_SCREEN]: [LAYER.CONTROL_PANEL]
        };

        return validTransitions[fromLayer]?.includes(toLayer) || false;
    }

    // ==================== Layer Visibility ====================

    /**
     * Hide a layer with animation
     * @private
     */
    async hideLayer(layer) {
        return new Promise(resolve => {
            const container = this.getLayerContainer(layer);
            if (!container) {
                resolve();
                return;
            }

            container.classList.remove('active');

            // Hide components based on layer
            switch (layer) {
                case LAYER.MAP:
                    if (window.app?.mapFullscreen) {
                        window.app.mapFullscreen.hide();
                    }
                    break;
                case LAYER.CONTROL_PANEL:
                    if (window.app?.dashboardGrid) {
                        window.app.dashboardGrid.hide();
                    }
                    break;
                case LAYER.DETAIL_SCREEN:
                    // Hide detail container
                    break;
            }

            setTimeout(() => {
                container.style.display = 'none';
                resolve();
            }, this.transitionDuration);
        });
    }

    /**
     * Show a layer with animation
     * @private
     */
    async showLayer(layer) {
        return new Promise(resolve => {
            const container = this.getLayerContainer(layer);
            if (!container) {
                resolve();
                return;
            }

            container.style.display = 'block';
            
            // Force reflow for transition
            container.offsetHeight;

            container.classList.add('active');

            // Show components based on layer
            switch (layer) {
                case LAYER.MAP:
                    if (window.app?.mapFullscreen) {
                        window.app.mapFullscreen.show();
                    }
                    break;
                case LAYER.CONTROL_PANEL:
                    if (window.app?.dashboardGrid) {
                        window.app.dashboardGrid.show();
                        const screens = window.app.screenManager?.getActiveScreens() || [];
                        window.app.dashboardGrid.render(screens);
                    }
                    break;
                case LAYER.DETAIL_SCREEN:
                    // Detail container is shown by IframeScreenManager
                    break;
            }

            setTimeout(() => {
                resolve();
            }, this.transitionDuration);
        });
    }

    /**
     * Get container element for a layer
     * @private
     */
    getLayerContainer(layer) {
        const containerIds = {
            [LAYER.MAP]: 'map-fullscreen-container',
            [LAYER.CONTROL_PANEL]: 'dashboard-container',
            [LAYER.DETAIL_SCREEN]: 'detail-container'
        };

        return document.getElementById(containerIds[layer]);
    }

    // ==================== Navigation Helpers ====================

    /**
     * Get current layer
     * @returns {number} - LAYER constant
     */
    getCurrentLayer() {
        return this.currentLayer;
    }

    /**
     * Get current layer type string
     * @returns {string}
     */
    getCurrentLayerType() {
        return LAYER_TO_TYPE[this.currentLayer];
    }

    /**
     * Get layer history
     * @returns {number[]}
     */
    getLayerHistory() {
        return [...this.layerHistory];
    }

    /**
     * Check if can go back
     * @returns {boolean}
     */
    canGoBack() {
        return this.layerHistory.length > 1;
    }

    /**
     * Handle back navigation (called by TVRemoteInputHandler)
     * @returns {Promise<boolean>}
     */
    async back() {
        return this.popLayer();
    }

    /**
     * Handle Enter key on dashboard tile
     * @param {number} screenSTT - Screen STT number
     * @returns {Promise<boolean>}
     */
    async openDetailScreen(screenSTT) {
        if (screenSTT === 0) {
            // M0 is map, go to map layer
            return this.pushLayer(LAYER.MAP);
        }

        return this.pushLayer(LAYER.DETAIL_SCREEN, { screenSTT });
    }

    /**
     * Handle transition from map to dashboard (when screens become available)
     * @returns {Promise<boolean>}
     */
    async showDashboard() {
        if (this.currentLayer === LAYER.MAP) {
            return this.pushLayer(LAYER.CONTROL_PANEL);
        }
        return false;
    }

    /**
     * Handle exit app request (on back from root layer)
     * @private
     */
    handleExitApp() {
        if (typeof Config !== 'undefined' && Config.isTizen && Config.isTizen()) {
            try {
                window.tizen.application.getCurrentApplication().exit();
            } catch (e) {
                this.log('Failed to exit Tizen app:', e);
            }
        }
    }

    // ==================== Event Management ====================

    /**
     * Register layer change callback
     * @param {Function} callback - (fromLayer, toLayer, params) => void
     */
    onLayerChange(callback) {
        if (typeof callback === 'function') {
            this.layerChangeCallbacks.push(callback);
        }
    }

    /**
     * Unregister layer change callback
     * @param {Function} callback
     */
    offLayerChange(callback) {
        const index = this.layerChangeCallbacks.indexOf(callback);
        if (index !== -1) {
            this.layerChangeCallbacks.splice(index, 1);
        }
    }

    /**
     * Notify all registered callbacks of layer change
     * @private
     */
    notifyLayerChange(fromLayer, toLayer, params) {
        this.layerChangeCallbacks.forEach(callback => {
            try {
                callback(fromLayer, toLayer, params);
            } catch (error) {
                this.log('Layer change callback error:', error);
            }
        });

        // Also dispatch custom event for external listeners
        window.dispatchEvent(new CustomEvent('layerChange', {
            detail: {
                from: fromLayer,
                to: toLayer,
                fromType: LAYER_TO_TYPE[fromLayer],
                toType: LAYER_TO_TYPE[toLayer],
                params
            }
        }));
    }

    // ==================== IframeManager Integration ====================

    /**
     * Set reference to IframeScreenManager
     * @param {IframeScreenManager} manager
     */
    setIframeManager(manager) {
        this.iframeManager = manager;
    }

    // ==================== Logging ====================

    /**
     * Log helper with prefix
     * @private
     */
    log(...args) {
        if (typeof Config !== 'undefined' && Config.log) {
            Config.log('debug', '[LayerNavigationManager]', ...args);
        } else {
            console.log('[LayerNavigationManager]', ...args);
        }
    }
}

// Create singleton instance
const layerNavigationManagerInstance = new LayerNavigationManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        LayerNavigationManager, 
        layerNavigationManagerInstance,
        LAYER,
        LAYER_TO_TYPE,
        TransitionState
    };
} else {
    window.LayerNavigationManager = LayerNavigationManager;
    window.layerNavigationManager = layerNavigationManagerInstance;
    window.LAYER = LAYER;
}
