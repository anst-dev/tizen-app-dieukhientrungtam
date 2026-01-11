/**
 * FocusManager.js - Quản lý focus state toàn cục cho TV Remote Navigation
 * 
 * Singleton pattern để đảm bảo focus state không bị mất hoặc reset.
 * Focus chỉ được save/restore khi explicitly gọi các method tương ứng.
 * 
 * QUAN TRỌNG: Các getter methods KHÔNG modify state.
 */

/**
 * Layer types enum
 */
const LayerType = {
    MAP: 'map',
    DASHBOARD: 'dashboard',
    DETAIL: 'detail'
};

/**
 * Direction types for navigation
 */
const Direction = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right'
};

/**
 * Focusable element selectors per layer
 */
const FOCUSABLE_SELECTORS = {
    [LayerType.MAP]: '.map-control-button, .zoom-control, .ol-zoom button',
    [LayerType.DASHBOARD]: '.screen-tile[tabindex="0"]',
    [LayerType.DETAIL]: '.focusable, .btn-view-all, .detail-widget[tabindex="0"], #iframe-container iframe'
};

/**
 * Layer container selectors
 */
const LAYER_CONTAINERS = {
    [LayerType.MAP]: '#map-fullscreen-container',
    [LayerType.DASHBOARD]: '#dashboard-container',
    [LayerType.DETAIL]: '#detail-container'
};

class FocusManager {
    constructor() {
        // Singleton pattern
        if (FocusManager.instance) {
            return FocusManager.instance;
        }
        FocusManager.instance = this;

        // Focus states storage - Map<LayerType, FocusState>
        this.focusStates = new Map();

        // Current active layer
        this.currentLayer = LayerType.MAP;

        // Focus state stack for layer transitions
        this.focusStateStack = [];

        // Currently focused element reference
        this.currentFocusedElement = null;

        // Focus trap container (if enabled)
        this.focusTrapContainer = null;

        // Initialized flag
        this.isInitialized = false;
    }

    /**
     * Initialize FocusManager
     */
    init() {
        if (this.isInitialized) {
            return;
        }

        // Initialize empty focus states for each layer
        Object.values(LayerType).forEach(layer => {
            this.focusStates.set(layer, null);
        });

        // Listen for focus changes
        document.addEventListener('focusin', this.handleFocusIn.bind(this));
        document.addEventListener('focusout', this.handleFocusOut.bind(this));

        this.isInitialized = true;
        this.log('FocusManager initialized');
    }

    /**
     * Destroy FocusManager
     */
    destroy() {
        document.removeEventListener('focusin', this.handleFocusIn.bind(this));
        document.removeEventListener('focusout', this.handleFocusOut.bind(this));
        
        this.focusStates.clear();
        this.focusStateStack = [];
        this.currentFocusedElement = null;
        this.focusTrapContainer = null;
        this.isInitialized = false;
        
        FocusManager.instance = null;
    }

    // ==================== Focus State Management ====================

    /**
     * Save current focus state for a layer
     * @param {string} layer - LayerType
     */
    saveFocusState(layer) {
        const focusedElement = this.currentFocusedElement || document.activeElement;
        
        if (!focusedElement || focusedElement === document.body) {
            this.log(`No focused element to save for layer: ${layer}`);
            return;
        }

        const focusState = {
            layer: layer,
            elementSelector: this.buildElementSelector(focusedElement),
            elementIndex: this.getElementIndex(focusedElement, layer),
            scrollPosition: this.getScrollPosition(layer),
            timestamp: Date.now(),
            metadata: this.buildLayerMetadata(focusedElement, layer)
        };

        this.focusStates.set(layer, focusState);
        this.focusStateStack.push({ layer, state: focusState });

        this.log(`Focus state saved for layer: ${layer}`, focusState);
    }

    /**
     * Restore focus state for a layer
     * @param {string} layer - LayerType
     * @returns {boolean} - Whether focus was successfully restored
     */
    restoreFocusState(layer) {
        const state = this.focusStates.get(layer);
        
        if (!state) {
            this.log(`No saved focus state for layer: ${layer}`);
            return this.focusFirstElement(layer);
        }

        // Strategy 1: Find by saved selector
        let element = document.querySelector(state.elementSelector);

        // Strategy 2: Find by index in focusable list
        if (!element) {
            const focusables = this.getFocusableElements(layer);
            element = focusables[state.elementIndex];
        }

        // Strategy 3: Fallback to first focusable element
        if (!element) {
            element = this.getFirstFocusable(layer);
        }

        if (element) {
            this.setFocus(element);
            
            // Restore scroll position if available
            if (state.scrollPosition) {
                this.restoreScrollPosition(layer, state.scrollPosition);
            }

            this.log(`Focus restored for layer: ${layer}`, element);
            return true;
        }

        this.log(`Failed to restore focus for layer: ${layer}`);
        return false;
    }

    /**
     * Clear focus state for a layer
     * @param {string} layer - LayerType
     */
    clearFocusState(layer) {
        this.focusStates.set(layer, null);
        this.log(`Focus state cleared for layer: ${layer}`);
    }

    // ==================== Focus Movement ====================

    /**
     * Move focus in a direction within current layer
     * @param {string} direction - Direction enum
     * @returns {boolean} - Whether focus was moved
     */
    moveFocus(direction) {
        console.log('[DEBUG] FocusManager.moveFocus called:', {
            direction,
            currentLayer: this.currentLayer,
            currentFocusedElement: this.currentFocusedElement?.id || this.currentFocusedElement?.getAttribute?.('data-stt'),
            activeElement: document.activeElement?.id || document.activeElement?.getAttribute?.('data-stt')
        });
        
        const focusables = this.getFocusableElements(this.currentLayer);
        console.log('[DEBUG] moveFocus: focusable elements:', {
            count: focusables.length,
            layer: this.currentLayer,
            elements: focusables.map(el => el.getAttribute?.('data-stt') || el.id || el.className)
        });
        
        const currentElement = this.currentFocusedElement || document.activeElement;
        const currentIndex = focusables.indexOf(currentElement);
        
        console.log('[DEBUG] moveFocus: current state:', {
            currentIndex,
            currentElementId: currentElement?.id,
            currentElementStt: currentElement?.getAttribute?.('data-stt'),
            isInFocusables: currentIndex !== -1
        });

        if (currentIndex === -1) {
            // No current focus, focus first element
            console.log('[DEBUG] moveFocus: No current focus in focusables list, focusing first element');
            return this.focusFirstElement(this.currentLayer);
        }

        let targetIndex = this.calculateTargetIndex(
            currentIndex,
            focusables.length,
            direction,
            this.currentLayer
        );

        console.log('[DEBUG] moveFocus: calculateTargetIndex result:', {
            currentIndex,
            targetIndex,
            willMove: targetIndex !== -1 && targetIndex !== currentIndex
        });

        if (targetIndex !== -1 && targetIndex !== currentIndex) {
            console.log('[DEBUG] moveFocus: Moving focus to element:', focusables[targetIndex]?.getAttribute?.('data-stt'));
            this.setFocus(focusables[targetIndex]);
            return true;
        }

        console.log('[DEBUG] moveFocus: No movement - targetIndex invalid or same as current');
        return false;
    }

    /**
     * Calculate target index based on direction and layout
     * @private
     */
    calculateTargetIndex(currentIndex, totalElements, direction, layer) {
        if (layer === LayerType.DASHBOARD) {
            // Use navigation attributes from tiles
            const currentElement = document.activeElement;
            if (currentElement && currentElement.classList.contains('screen-tile')) {
                const navAttr = `data-nav-${direction}`;
                const targetIndexStr = currentElement.getAttribute(navAttr);
                if (targetIndexStr && targetIndexStr !== '-1') {
                    return parseInt(targetIndexStr, 10);
                }
                
                // Try STT-based navigation
                const targetStt = currentElement.getAttribute(`${navAttr}-stt`);
                if (targetStt && targetStt !== '-1') {
                    const targetElement = document.querySelector(`.screen-tile[data-stt="${targetStt}"]`);
                    if (targetElement) {
                        const focusables = this.getFocusableElements(layer);
                        return focusables.indexOf(targetElement);
                    }
                }
            }
        }

        // Default linear navigation for other layers
        let targetIndex = currentIndex;
        switch (direction) {
            case Direction.UP:
            case Direction.LEFT:
                targetIndex = Math.max(0, currentIndex - 1);
                break;
            case Direction.DOWN:
            case Direction.RIGHT:
                targetIndex = Math.min(totalElements - 1, currentIndex + 1);
                break;
        }

        return targetIndex;
    }

    /**
     * Set focus to a specific element
     * @param {HTMLElement} element
     */
    setFocus(element) {
        if (!element) return;

        // Remove focus from previous element
        if (this.currentFocusedElement) {
            this.currentFocusedElement.classList.remove('focused');
        }

        // Set focus to new element
        element.focus();
        element.classList.add('focused');
        this.currentFocusedElement = element;

        // Scroll element into view
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });

        this.log('Focus set to element:', element);
    }

    /**
     * Get currently focused element - READONLY, does not modify state
     * @returns {HTMLElement|null}
     */
    getFocusedElement() {
        // Return current tracked element without modifying any state
        return this.currentFocusedElement || document.activeElement;
    }

    // ==================== Focus Queries - READONLY ====================

    /**
     * Check if a layer has saved focus state - READONLY
     * @param {string} layer - LayerType
     * @returns {boolean}
     */
    hasFocus(layer) {
        return this.focusStates.has(layer) && this.focusStates.get(layer) !== null;
    }

    /**
     * Get focus state for a layer - READONLY, returns copy
     * @param {string} layer - LayerType
     * @returns {Object|null}
     */
    getFocusState(layer) {
        const state = this.focusStates.get(layer);
        // Return a copy to prevent external modification
        return state ? { ...state, metadata: { ...state.metadata } } : null;
    }

    // ==================== Layer Management ====================

    /**
     * Set current active layer
     * @param {string} layer - LayerType
     */
    setCurrentLayer(layer) {
        this.currentLayer = layer;
        this.log(`Current layer set to: ${layer}`);
    }

    /**
     * Get current active layer
     * @returns {string} - LayerType
     */
    getCurrentLayer() {
        return this.currentLayer;
    }

    // ==================== Focus Trap ====================

    /**
     * Enable focus trap within a container
     * @param {HTMLElement} container
     */
    enableFocusTrap(container) {
        this.focusTrapContainer = container;
        this.log('Focus trap enabled for container:', container);
    }

    /**
     * Disable focus trap
     */
    disableFocusTrap() {
        this.focusTrapContainer = null;
        this.log('Focus trap disabled');
    }

    // ==================== Helper Methods ====================

    /**
     * Build a unique selector for an element
     * @private
     */
    buildElementSelector(element) {
        // Priority 1: data-stt attribute (for screen tiles)
        if (element.hasAttribute('data-stt')) {
            return `.screen-tile[data-stt="${element.getAttribute('data-stt')}"]`;
        }

        // Priority 2: id attribute
        if (element.id) {
            return `#${element.id}`;
        }

        // Priority 3: data-index attribute
        if (element.hasAttribute('data-index')) {
            const className = element.className.split(' ')[0];
            return `.${className}[data-index="${element.getAttribute('data-index')}"]`;
        }

        // Priority 4: class + nth-child
        const parent = element.parentElement;
        if (parent) {
            const index = Array.from(parent.children).indexOf(element);
            return `${parent.tagName.toLowerCase()} > :nth-child(${index + 1})`;
        }

        return null;
    }

    /**
     * Get index of element in focusable list
     * @private
     */
    getElementIndex(element, layer) {
        const focusables = this.getFocusableElements(layer);
        return focusables.indexOf(element);
    }

    /**
     * Build layer-specific metadata
     * @private
     */
    buildLayerMetadata(element, layer) {
        const metadata = {};

        switch (layer) {
            case LayerType.MAP:
                // Get map center and zoom if available
                const mapComponent = window.app?.mapFullscreen;
                if (mapComponent && mapComponent.map) {
                    const view = mapComponent.map.getView();
                    metadata.center = view.getCenter();
                    metadata.zoom = view.getZoom();
                }
                break;

            case LayerType.DASHBOARD:
                metadata.screenSTT = element.getAttribute('data-stt');
                metadata.tileIndex = element.getAttribute('data-index');
                break;

            case LayerType.DETAIL:
                metadata.widgetId = element.id || null;
                metadata.iframeLoaded = !!document.querySelector('#iframe-container iframe');
                break;
        }

        return metadata;
    }

    /**
     * Get scroll position for a layer
     * @private
     */
    getScrollPosition(layer) {
        const container = this.getLayerContainer(layer);
        if (container) {
            return {
                x: container.scrollLeft,
                y: container.scrollTop
            };
        }
        return { x: 0, y: 0 };
    }

    /**
     * Restore scroll position for a layer
     * @private
     */
    restoreScrollPosition(layer, position) {
        const container = this.getLayerContainer(layer);
        if (container && position) {
            container.scrollLeft = position.x;
            container.scrollTop = position.y;
        }
    }

    /**
     * Get layer container element
     * @private
     */
    getLayerContainer(layer) {
        const selector = LAYER_CONTAINERS[layer];
        return selector ? document.querySelector(selector) : null;
    }

    /**
     * Get all focusable elements in a layer
     */
    getFocusableElements(layer) {
        const container = this.getLayerContainer(layer);
        if (!container) return [];

        const selector = FOCUSABLE_SELECTORS[layer];
        if (!selector) return [];

        return Array.from(container.querySelectorAll(selector))
            .filter(el => el.offsetParent !== null); // Only visible elements
    }

    /**
     * Get first focusable element in a layer
     */
    getFirstFocusable(layer) {
        const focusables = this.getFocusableElements(layer);
        return focusables.length > 0 ? focusables[0] : null;
    }

    /**
     * Focus first element in a layer
     */
    focusFirstElement(layer) {
        const firstElement = this.getFirstFocusable(layer);
        if (firstElement) {
            this.setFocus(firstElement);
            return true;
        }
        return false;
    }

    // ==================== Dynamic Refresh ====================

    /**
     * Refresh focusable elements when DOM changes
     * Call this after rendering new content or removing elements
     * IMPORTANT: This method preserves focus state - it will NOT reset focus
     * unless the focused element is removed from DOM
     *
     * @param {string} layer - Optional specific layer to refresh, defaults to current layer
     * @returns {Object} - Refresh result with focusable count and focus status
     */
    refreshFocusableElements(layer = null) {
        const targetLayer = layer || this.currentLayer;
        
        this.log(`Refreshing focusable elements for layer: ${targetLayer}`);

        // CRITICAL: Save complete focus info BEFORE any DOM queries
        const focusedElement = this.currentFocusedElement || document.activeElement;
        
        // Capture all identifying information about the focused element
        const focusInfo = this.captureFocusInfo(focusedElement);
        
        // Check if current focused element still exists and is visible in DOM
        const isFocusedElementValid = focusedElement &&
            focusedElement !== document.body &&
            document.body.contains(focusedElement) &&
            focusedElement.offsetParent !== null;

        // Get updated focusable elements
        const focusables = this.getFocusableElements(targetLayer);

        const result = {
            layer: targetLayer,
            focusableCount: focusables.length,
            previousFocusValid: isFocusedElementValid,
            focusRestored: false,
            focusedElement: null,
            focusInfo: focusInfo
        };

        // If focused element is still valid, just keep it - DO NOT CHANGE FOCUS
        if (isFocusedElementValid) {
            result.focusedElement = focusedElement;
            result.focusRestored = true;
            this.log('Focus preserved - element still valid');
            
            // Dispatch event and return early
            window.dispatchEvent(new CustomEvent('focusableElementsRefreshed', {
                detail: result
            }));
            return result;
        }

        // Only attempt to restore focus if the element is no longer valid
        this.log('Current focused element is invalid, attempting to restore focus');
        
        // Strategy 1: Try to find element by data-stt (most reliable for dashboard)
        if (focusInfo.stt !== null && focusInfo.stt !== undefined) {
            const sttElement = document.querySelector(`.screen-tile[data-stt="${focusInfo.stt}"]`);
            if (sttElement && document.body.contains(sttElement)) {
                this.setFocus(sttElement);
                result.focusRestored = true;
                result.focusedElement = sttElement;
                this.log(`Focus restored by data-stt: ${focusInfo.stt}`);
            }
        }

        // Strategy 2: Try by element ID
        if (!result.focusRestored && focusInfo.id) {
            const idElement = document.getElementById(focusInfo.id);
            if (idElement && document.body.contains(idElement)) {
                this.setFocus(idElement);
                result.focusRestored = true;
                result.focusedElement = idElement;
                this.log(`Focus restored by id: ${focusInfo.id}`);
            }
        }

        // Strategy 3: Try by saved selector
        if (!result.focusRestored && focusInfo.selector) {
            try {
                const selectorElement = document.querySelector(focusInfo.selector);
                if (selectorElement && document.body.contains(selectorElement)) {
                    this.setFocus(selectorElement);
                    result.focusRestored = true;
                    result.focusedElement = selectorElement;
                    this.log(`Focus restored by selector: ${focusInfo.selector}`);
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }

        // Strategy 4: Try by saved index in focusables list
        if (!result.focusRestored && focusInfo.index >= 0 && focusables.length > 0) {
            const clampedIndex = Math.min(focusInfo.index, focusables.length - 1);
            const indexElement = focusables[clampedIndex];
            if (indexElement && document.body.contains(indexElement)) {
                this.setFocus(indexElement);
                result.focusRestored = true;
                result.focusedElement = indexElement;
                this.log(`Focus restored by index: ${clampedIndex}`);
            }
        }

        // Strategy 5: Try from saved state
        if (!result.focusRestored) {
            const savedState = this.focusStates.get(targetLayer);
            if (savedState) {
                // Try selector from saved state
                if (savedState.elementSelector) {
                    try {
                        const savedElement = document.querySelector(savedState.elementSelector);
                        if (savedElement && document.body.contains(savedElement)) {
                            this.setFocus(savedElement);
                            result.focusRestored = true;
                            result.focusedElement = savedElement;
                            this.log('Focus restored from saved state selector');
                        }
                    } catch (e) {
                        // Invalid selector
                    }
                }

                // Try metadata from saved state
                if (!result.focusRestored && savedState.metadata?.screenSTT !== undefined) {
                    const metaElement = document.querySelector(
                        `.screen-tile[data-stt="${savedState.metadata.screenSTT}"]`
                    );
                    if (metaElement && document.body.contains(metaElement)) {
                        this.setFocus(metaElement);
                        result.focusRestored = true;
                        result.focusedElement = metaElement;
                        this.log('Focus restored from saved state metadata');
                    }
                }
            }
        }

        // Fallback: Focus first element if nothing else works
        if (!result.focusRestored && focusables.length > 0) {
            this.setFocus(focusables[0]);
            result.focusRestored = true;
            result.focusedElement = focusables[0];
            this.log('Fallback: focused first element');
        }

        // Clear invalid reference if restoration failed
        if (!result.focusRestored) {
            this.currentFocusedElement = null;
        }

        // Dispatch event for other components to know about refresh
        window.dispatchEvent(new CustomEvent('focusableElementsRefreshed', {
            detail: result
        }));

        this.log('Focusable elements refreshed:', result);
        return result;
    }

    /**
     * Capture all identifying information about a focused element
     * This is used to restore focus after DOM changes
     * @private
     * @param {HTMLElement} element - The element to capture info from
     * @returns {Object} - Focus info object
     */
    captureFocusInfo(element) {
        const info = {
            stt: null,
            id: null,
            selector: null,
            index: -1,
            dataIndex: null,
            className: null
        };

        if (!element || element === document.body) {
            return info;
        }

        // Capture data-stt (critical for dashboard tiles)
        if (element.hasAttribute('data-stt')) {
            info.stt = element.getAttribute('data-stt');
        }

        // Capture ID
        if (element.id) {
            info.id = element.id;
        }

        // Capture data-index
        if (element.hasAttribute('data-index')) {
            info.dataIndex = element.getAttribute('data-index');
        }

        // Capture class name
        if (element.className) {
            info.className = element.className;
        }

        // Build selector
        info.selector = this.buildElementSelector(element);

        // Calculate index in current layer's focusables
        const focusables = this.getFocusableElements(this.currentLayer);
        info.index = focusables.indexOf(element);

        return info;
    }

    /**
     * Handle when a focused element is about to be removed
     * Call this before removing elements from DOM
     * @param {HTMLElement} elementToRemove - Element that will be removed
     * @returns {boolean} - True if focus was on the element and needs handling
     */
    handleElementRemoval(elementToRemove) {
        if (!elementToRemove) return false;

        const focusedElement = this.currentFocusedElement || document.activeElement;
        
        // Check if focused element is the one being removed or is a child of it
        const needsHandling = focusedElement === elementToRemove ||
            elementToRemove.contains(focusedElement);

        if (needsHandling) {
            this.log('Focused element is being removed, saving state');
            
            // Save current focus state before removal
            this.saveFocusState(this.currentLayer);

            // Try to find next focusable sibling
            const focusables = this.getFocusableElements(this.currentLayer);
            const currentIndex = focusables.indexOf(focusedElement);
            
            let nextFocus = null;
            
            // Try next element
            if (currentIndex >= 0 && currentIndex < focusables.length - 1) {
                nextFocus = focusables[currentIndex + 1];
            }
            // Try previous element
            else if (currentIndex > 0) {
                nextFocus = focusables[currentIndex - 1];
            }
            // Try first element (excluding the one being removed)
            else {
                nextFocus = focusables.find(el => el !== elementToRemove && !elementToRemove.contains(el));
            }

            if (nextFocus) {
                // Schedule focus change after DOM update
                setTimeout(() => {
                    if (document.body.contains(nextFocus)) {
                        this.setFocus(nextFocus);
                    }
                }, 0);
            }

            return true;
        }

        return false;
    }

    /**
     * Validate and cleanup focus state
     * Removes invalid focus states and ensures consistency
     */
    validateFocusStates() {
        this.focusStates.forEach((state, layer) => {
            if (state && state.elementSelector) {
                const element = document.querySelector(state.elementSelector);
                if (!element || !document.body.contains(element)) {
                    this.log(`Clearing invalid focus state for layer: ${layer}`);
                    this.focusStates.set(layer, null);
                }
            }
        });

        // Validate current focused element
        if (this.currentFocusedElement && !document.body.contains(this.currentFocusedElement)) {
            this.log('Current focused element no longer in DOM, clearing reference');
            this.currentFocusedElement = null;
        }
    }

    /**
     * Setup MutationObserver to auto-refresh when DOM changes
     * @param {string} layer - Layer to observe
     * @param {boolean} autoFocus - Whether to auto-focus when elements are added
     */
    observeLayerChanges(layer, autoFocus = false) {
        const container = this.getLayerContainer(layer);
        if (!container) {
            this.log(`Cannot observe layer ${layer}: container not found`);
            return null;
        }

        const observer = new MutationObserver((mutations) => {
            let hasRelevantChanges = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' &&
                    (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                    hasRelevantChanges = true;
                }
            });

            if (hasRelevantChanges) {
                this.log(`DOM changes detected in layer: ${layer}`);
                
                // Debounce refresh to avoid multiple calls
                if (this._refreshTimeout) {
                    clearTimeout(this._refreshTimeout);
                }
                
                this._refreshTimeout = setTimeout(() => {
                    const result = this.refreshFocusableElements(layer);
                    
                    if (autoFocus && !result.focusedElement && result.focusableCount > 0) {
                        this.focusFirstElement(layer);
                    }
                }, 50);
            }
        });

        observer.observe(container, {
            childList: true,
            subtree: true
        });

        this.log(`MutationObserver started for layer: ${layer}`);
        return observer;
    }

    // ==================== Event Handlers ====================

    /**
     * Handle focus in event
     * @private
     */
    handleFocusIn(event) {
        const target = event.target;
        
        // Check if focus is within focus trap
        if (this.focusTrapContainer && !this.focusTrapContainer.contains(target)) {
            // Focus is outside trap, redirect to trap container
            const firstFocusable = this.focusTrapContainer.querySelector(
                FOCUSABLE_SELECTORS[this.currentLayer]
            );
            if (firstFocusable) {
                firstFocusable.focus();
                return;
            }
        }

        // Update current focused element
        this.currentFocusedElement = target;
        target.classList.add('focused');
    }

    /**
     * Handle focus out event
     * @private
     */
    handleFocusOut(event) {
        const target = event.target;
        target.classList.remove('focused');
    }

    // ==================== Logging ====================

    /**
     * Log helper with prefix
     * @private
     */
    log(...args) {
        if (typeof Config !== 'undefined' && Config.log) {
            Config.log('debug', '[FocusManager]', ...args);
        } else {
            console.log('[FocusManager]', ...args);
        }
    }
}

// Export singleton instance
const focusManagerInstance = new FocusManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FocusManager, focusManagerInstance, LayerType, Direction };
} else {
    window.FocusManager = FocusManager;
    window.focusManager = focusManagerInstance;
    window.LayerType = LayerType;
    window.Direction = Direction;
}
