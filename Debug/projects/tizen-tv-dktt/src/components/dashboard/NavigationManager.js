/**
 * NavigationManager.js - Quản lý điều hướng bằng remote control
 */

class NavigationManager {
    constructor() {
        this.currentFocus = null;
        this.currentView = 'map'; // 'map', 'dashboard', 'detail'
        this.navigationMap = new Map();
        this.focusHistory = [];
        this.isNavigating = false;
        this.keyHandlers = new Map();
    }

    /**
     * Khởi tạo NavigationManager
     */
    init() {
        this.bindKeyEvents();
        this.setupKeyHandlers();
        this.registerTizenKeys();
        Config.log('info', 'NavigationManager initialized');
    }

    /**
     * Setup các key handlers
     */
    setupKeyHandlers() {
        // Arrow keys
        this.keyHandlers.set('ArrowUp', () => this.navigate('up'));
        this.keyHandlers.set('ArrowDown', () => this.navigate('down'));
        this.keyHandlers.set('ArrowLeft', () => this.navigate('left'));
        this.keyHandlers.set('ArrowRight', () => this.navigate('right'));

        // Enter/OK key
        this.keyHandlers.set('Enter', () => this.handleEnter());

        // Back key
        this.keyHandlers.set('Escape', () => this.handleBack());
        this.keyHandlers.set('10009', () => this.handleBack()); // Tizen Back key

        // Number keys for quick navigation (including 0 for M0)
        for (let i = 0; i <= 9; i++) {
            this.keyHandlers.set(String(i), () => this.quickNavigate(i));
        }

        const zoomIn = () => this.zoomMap(1);
        const zoomOut = () => this.zoomMap(-1);

        const zoomInKeys = ['AudioVolumeUp', 'VolumeUp', '+', '='];
        const zoomOutKeys = ['AudioVolumeDown', 'VolumeDown', '-', '_'];
        const zoomInCodes = ['175', '447', '107', '187'];
        const zoomOutCodes = ['174', '448', '109', '189'];

        zoomInKeys.forEach(key => this.keyHandlers.set(key, zoomIn));
        zoomOutKeys.forEach(key => this.keyHandlers.set(key, zoomOut));
        zoomInCodes.forEach(code => this.keyHandlers.set(code, zoomIn));
        zoomOutCodes.forEach(code => this.keyHandlers.set(code, zoomOut));
    }

    /**
     * Bind keyboard events
     */
    bindKeyEvents() {
        const zoomKeys = ['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', '+', '-', '=', '_'];
        const zoomKeyCodes = ['175', '174', '447', '448', '107', '109', '187', '189'];

        document.addEventListener('keydown', (e) => {
            // Prevent default cho navigation keys
            if (Config.NAVIGATION.KEYS.UP.includes(e.key) ||
                Config.NAVIGATION.KEYS.DOWN.includes(e.key) ||
                Config.NAVIGATION.KEYS.LEFT.includes(e.key) ||
                Config.NAVIGATION.KEYS.RIGHT.includes(e.key) ||
                Config.NAVIGATION.KEYS.ENTER.includes(e.key) ||
                Config.NAVIGATION.KEYS.BACK.includes(e.key) ||
                zoomKeys.includes(e.key) ||
                zoomKeyCodes.includes(String(e.keyCode))) {
                e.preventDefault();
            }

            // Handle navigation
            this.handleKeyPress(e.key, e.keyCode);
        });

        // Listen for view changes
        window.addEventListener('viewChange', (e) => {
            this.currentView = e.detail.view;
            this.resetNavigation();
            Config.log('debug', `View changed to: ${this.currentView}`);
        });
    }

    /**
     * Register hardware keys on Tizen devices
     */
    registerTizenKeys() {
        if (!Config.isTizen()) {
            return;
        }

        try {
            const tvInputDevice = window.tizen && window.tizen.tvinputdevice;
            if (!tvInputDevice || typeof tvInputDevice.registerKey !== 'function') {
                return;
            }

            ['VolumeUp', 'VolumeDown'].forEach(key => {
                try {
                    tvInputDevice.registerKey(key);
                } catch (error) {
                    Config.log('warn', `Failed to register ${key} key`, error);
                }
            });
        } catch (error) {
            Config.log('warn', 'Unable to register Tizen hardware keys', error);
        }
    }

    /**
     * Handle key press
     */
    handleKeyPress(key, keyCode) {
        if (this.isNavigating) return;

        // Check if we have a handler for this key
        const handler = this.keyHandlers.get(key) || this.keyHandlers.get(String(keyCode));

        if (handler) {
            this.isNavigating = true;
            handler();

            // Reset navigation flag after delay
            setTimeout(() => {
                this.isNavigating = false;
            }, Config.NAVIGATION.FOCUS_DELAY);
        }
    }

    /**
     * Navigate theo hướng
     * @param {string} direction - 'up', 'down', 'left', 'right'
     */
    navigate(direction) {
        Config.log('debug', `Navigating ${direction} in ${this.currentView} view`);

        switch (this.currentView) {
            case 'map':
                this.navigateInMap(direction);
                break;
            case 'dashboard':
                this.navigateInDashboard(direction);
                break;
            case 'detail':
                this.navigateInDetail(direction);
                break;
        }
    }

    /**
     * Navigate trong map view
     */
    navigateInMap(direction) {
        // Trong map view, có thể pan bản đồ
        const map = this.getMapInstance();
        if (!map) return;

        const view = map.getView();
        const center = view.getCenter();
        const resolution = view.getResolution();
        const panDistance = resolution * 100; // Pan 100 pixels

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
            duration: Config.NAVIGATION.ANIMATION_DURATION
        });
    }

    /**
     * Get map component instance
     */
    getMapComponent() {
        if (window.app && window.app.mapFullscreen) {
            return window.app.mapFullscreen;
        }

        if (window.mapFullscreen) {
            return window.mapFullscreen;
        }

        return null;
    }

    /**
     * Get OpenLayers map instance
     */
    getMapInstance() {
        const component = this.getMapComponent();
        if (!component) {
            return null;
        }

        if (typeof component.getMap === 'function') {
            const map = component.getMap();
            if (map) {
                return map;
            }
        }

        if (component.map) {
            return component.map;
        }

        return null;
    }

    /**
     * Adjust map zoom level
     * @param {number} step
     */
    zoomMap(step = 1) {
        if (this.currentView !== 'map') {
            return;
        }

        const mapComponent = this.getMapComponent();
        if (mapComponent && typeof mapComponent.adjustZoom === 'function') {
            mapComponent.adjustZoom(step);
            return;
        }

        const map = this.getMapInstance();
        if (!map) {
            return;
        }

        const view = map.getView();
        if (!view) {
            return;
        }

        const currentZoom = typeof view.getZoom === 'function' ? view.getZoom() : Config.MAP.FULLSCREEN_ZOOM;
        const minZoom = typeof Config.MAP.MIN_ZOOM === 'number' ? Config.MAP.MIN_ZOOM : 0;
        const maxZoom = typeof Config.MAP.MAX_ZOOM === 'number' ? Config.MAP.MAX_ZOOM : 28;
        const targetZoom = Math.min(maxZoom, Math.max(minZoom, currentZoom + step));

        if (targetZoom === currentZoom) {
            return;
        }

        const animationDuration = (Config.NAVIGATION && Config.NAVIGATION.ANIMATION_DURATION) || 300;
        view.animate({
            zoom: targetZoom,
            duration: animationDuration
        });
    }

    /**
     * Navigate trong dashboard view
     */
    navigateInDashboard(direction) {
        Config.log('debug', `navigateInDashboard called: direction=${direction}, currentView=${this.currentView}`);

        const currentElement = document.activeElement;

        // Nếu chưa có focus, focus vào màn hình đầu tiên
        if (!currentElement || !currentElement.classList.contains('screen-tile')) {
            Config.log('debug', 'No focused screen tile, focusing first screen');
            const firstScreen = document.querySelector('.screen-tile');
            if (firstScreen) {
                this.moveFocus(firstScreen);
            }
            return;
        }

        // Get navigation target attributes
        const navAttr = `data-nav-${direction}`;
        const targetIndex = currentElement.getAttribute(navAttr);
        let targetElement = null;

        Config.log('debug', `Current element:`, currentElement, `Target index: ${targetIndex}`);

        if (targetIndex && targetIndex !== '-1') {
            targetElement = document.querySelector(`.screen-tile[data-index="${targetIndex}"]`);
        }

        if (!targetElement) {
            const targetStt = currentElement.getAttribute(`${navAttr}-stt`);
            if (targetStt && targetStt !== '-1') {
                targetElement = document.querySelector(`.screen-tile[data-stt="${targetStt}"]`);
            }
        }

        if (targetElement) {
            Config.log('debug', `Moving focus to target element:`, targetElement);
            this.moveFocus(targetElement);
        } else {
            Config.log('debug', `No target element found for direction: ${direction}`);
        }
    }
    /**
     * Navigate trong detail view
     */
    navigateInDetail(direction) {
        const widgets = document.querySelectorAll('.detail-widget');
        if (!widgets.length) return;

        const currentIndex = Array.from(widgets).findIndex(w => w === document.activeElement);
        let newIndex = currentIndex;

        // Widget layout: 2x2
        const row = Math.floor(currentIndex / 2);
        const col = currentIndex % 2;

        switch (direction) {
            case 'up':
                if (row > 0) newIndex = currentIndex - 2;
                break;
            case 'down':
                if (row < 1) newIndex = currentIndex + 2;
                break;
            case 'left':
                if (col > 0) newIndex = currentIndex - 1;
                break;
            case 'right':
                if (col < 1) newIndex = currentIndex + 1;
                break;
        }

        if (newIndex >= 0 && newIndex < widgets.length && newIndex !== currentIndex) {
            this.moveFocus(widgets[newIndex]);
        }
    }

    /**
     * Move focus to element
     */
    moveFocus(element) {
        if (!element) return;

        // Remove old focus
        if (this.currentFocus) {
            this.currentFocus.classList.remove('focused');
        }

        // Add new focus
        element.focus();
        element.classList.add('focused');
        this.currentFocus = element;

        // Scroll into view
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });

        // Add to history
        this.focusHistory.push(element);
        if (this.focusHistory.length > 10) {
            this.focusHistory.shift();
        }

        Config.log('debug', `Focus moved to element:`, element);
    }

    /**
     * Handle Enter key
     */
    handleEnter() {
        Config.log('debug', `Enter pressed in ${this.currentView} view`);

        switch (this.currentView) {
            case 'map':
                this.zoomMap(1);
                break;

            case 'dashboard':
                // Trong dashboard, Enter mở chi tiết màn hình
                const focusedScreen = document.activeElement;
                if (focusedScreen && focusedScreen.classList.contains('screen-tile')) {
                    const stt = focusedScreen.getAttribute('data-stt');
                    if (stt) {
                        const screenNumber = parseInt(stt);

                        // M0 (screen 0) - navigate to map view
                        if (screenNumber === 0) {
                            Config.log('info', 'M0 selected - navigating to map view');
                            if (window.app && typeof window.app.lockMapView === 'function') {
                                window.app.lockMapView();
                            }
                            window.app.router.navigate('/map');
                        } else {
                            // Other screens - open detail view
                            window.dispatchEvent(new CustomEvent('openScreenDetail', {
                                detail: { stt: screenNumber }
                            }));
                        }
                    }
                }
                break;

            case 'detail':
                // Trong detail, Enter có thể kích hoạt widget
                const focusedWidget = document.activeElement;
                if (focusedWidget && focusedWidget.classList.contains('detail-widget')) {
                    focusedWidget.click();
                }
                break;
        }
    }

    /**
     * Handle Back key
     */
    handleBack() {
        Config.log('debug', `Back pressed in ${this.currentView} view`);

        // Thực hiện logic tương tự như routes.back()
        const detailContainer = document.getElementById('detail-container');
        
        // Clear detail container content trước
        if (detailContainer) {
            // Clear all widget contents
            const widgets = detailContainer.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
            });
            
            // Remove iframe container completely
            const iframeContainer = detailContainer.querySelector('#iframe-container');
            if (iframeContainer) {
                iframeContainer.remove();
            }
            
            // Show widget grid again
            const widgetGrid = detailContainer.querySelector('.widget-grid');
            if (widgetGrid) {
                widgetGrid.style.display = '';
            }
        }
        
        // Luôn quay về Dashboard - hệ thống 2 cấp đơn giản
        this.hideAllContainers();
        
        // Đợi một chút để animation hoàn tất
        setTimeout(() => {
            // Hiển thị Dashboard
            const dashboardContainer = document.getElementById('dashboard-container');
            if (dashboardContainer) {
                dashboardContainer.style.display = 'block';
                // Force reflow trước khi add class active
                dashboardContainer.offsetHeight;
                dashboardContainer.classList.add('active');
            }
            
            // Render lại Dashboard Grid
            if (window.app && window.app.dashboardGrid) {
                window.app.dashboardGrid.show();
                const screens = window.app.screenManager?.getActiveScreens() || [];
                window.app.dashboardGrid.render(screens);
            }
            
        }, 50);
        
        // Reset màn hình hiện tại và currentView
        this.currentView = 'dashboard';
        
        // Reset currentScreen trong Routes nếu có
        if (window.app && window.app.routes) {
            window.app.routes.currentScreen = null;
        }
    }

    /**
     * Ẩn tất cả containers
     */
    hideAllContainers() {
        const mapContainer = document.getElementById('map-fullscreen-container');
        const dashboardContainer = document.getElementById('dashboard-container');
        const detailContainer = document.getElementById('detail-container');
        
        // Remove active class trước
        if (mapContainer) {
            mapContainer.classList.remove('active');
        }
        
        if (dashboardContainer) {
            dashboardContainer.classList.remove('active');
        }
        
        if (detailContainer) {
            detailContainer.classList.remove('active');
            
            // Clear widget contents
            const widgets = detailContainer.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
            });
            
            // Reset widget grid display
            const widgetGrid = detailContainer.querySelector('.widget-grid');
            if (widgetGrid) {
                widgetGrid.style.display = '';
            }
            
            // Remove iframe container completely
            const iframeContainer = detailContainer.querySelector('#iframe-container');
            if (iframeContainer) {
                iframeContainer.remove();
            }
        }

        // Hide components
        if (window.app) {
            if (window.app.mapFullscreen) {
                window.app.mapFullscreen.hide();
            }
            if (window.app.dashboardGrid) {
                window.app.dashboardGrid.hide();
            }
        }

        // Set display none sau khi remove class
        setTimeout(() => {
            if (mapContainer) {
                mapContainer.style.display = 'none';
            }
            
            if (dashboardContainer) {
                dashboardContainer.style.display = 'none';
            }
            
            if (detailContainer) {
                detailContainer.style.display = 'none';
            }
        }, 10);
    }

    /**
     * Quick navigate to screen by number
     */
    quickNavigate(number) {
        if (this.currentView !== 'dashboard') return;

        const targetScreen = document.querySelector(`.screen-tile[data-stt="${number}"]`);
        if (targetScreen) {
            this.moveFocus(targetScreen);
            Config.log('info', `Quick navigated to screen ${number}`);

            // If it's M0, automatically navigate to map
            if (number === 0) {
                setTimeout(() => {
                    this.handleEnter(); // Trigger enter to open map
                }, 100);
            }
        }
    }

    /**
     * Reset navigation state
     */
    resetNavigation() {
        this.currentFocus = null;
        this.focusHistory = [];
        this.navigationMap.clear();

        // Remove all focused classes
        document.querySelectorAll('.focused').forEach(el => {
            el.classList.remove('focused');
        });
    }

    /**
     * Build navigation map cho current view
     */
    buildNavigationMap() {
        this.navigationMap.clear();

        switch (this.currentView) {
            case 'dashboard':
                // Build map cho dashboard screens
                const screens = document.querySelectorAll('.screen-tile');
                screens.forEach((screen, index) => {
                    const navData = {
                        element: screen,
                        index: index,
                        up: parseInt(screen.getAttribute('data-nav-up')),
                        down: parseInt(screen.getAttribute('data-nav-down')),
                        left: parseInt(screen.getAttribute('data-nav-left')),
                        right: parseInt(screen.getAttribute('data-nav-right'))
                    };
                    this.navigationMap.set(index, navData);
                });
                break;

            case 'detail':
                // Build map cho widgets
                const widgets = document.querySelectorAll('.detail-widget');
                widgets.forEach((widget, index) => {
                    this.navigationMap.set(index, {
                        element: widget,
                        index: index
                    });
                });
                break;
        }

        Config.log('debug', `Built navigation map for ${this.currentView} with ${this.navigationMap.size} elements`);
    }

    /**
     * Get current focused element info
     */
    getCurrentFocusInfo() {
        return {
            element: this.currentFocus,
            view: this.currentView,
            history: this.focusHistory
        };
    }

    /**
     * Destroy navigation manager
     */
    destroy() {
        this.resetNavigation();
        document.removeEventListener('keydown', this.handleKeyPress);
        Config.log('info', 'NavigationManager destroyed');
    }
}

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
} else {
    window.NavigationManager = NavigationManager;
}
