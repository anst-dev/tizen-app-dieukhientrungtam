/**
 * App.js - Main application entry point
 */

class App {
    constructor() {
        // Services
        this.apiService = null;
        this.screenManager = null;
        this.navigationManager = null;
        this.router = null;
        this.routes = null; // New simplified routing system

        // Components
        this.mapFullscreen = null;
        this.dashboardGrid = null;

        // State
        this.isInitialized = false;
        this.currentView = 'loading';
        this.isMapViewLocked = false;
    }

    /**
     * Initialize application
     */
    async init() {
        try {

            // Show loading
            this.showLoading();

            // Initialize services
            await this.initServices();

            // Initialize components
            await this.initComponents();

            // Setup routes
            this.setupRoutes();

            // Bind events
            this.bindEvents();

            // Start application
            await this.start();

            this.isInitialized = true;

        } catch (error) {
            this.showError('Không thể khởi động ứng dụng. Vui lòng thử lại.');
        }
    }

    /**
     * Initialize services
     */
    async initServices() {

        // API Service
        this.apiService = new ApiService();

        // Screen Manager
        this.screenManager = new ScreenManager();
        this.screenManager.init();

        // Navigation Manager
        this.navigationManager = new NavigationManager();
        this.navigationManager.init();

        // Router (keep for compatibility)
        this.router = new Router();

        // New simplified Routes system
        this.routes = new Routes();
        this.routes.init();

        // Setup protection against unwanted content injection
        this.setupWidgetProtection();
    }

    /**
     * Setup protection against unwanted content injection
     */
    setupWidgetProtection() {
        // Monitor for any changes to widget content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.target.classList && mutation.target.classList.contains('widget-content')) {
                    // If content contains suspicious text, clear it
                    const content = mutation.target.textContent || '';
                    if (content.includes('Opus') || content.includes('48gh') || content.includes('Claude')) {
                        mutation.target.innerHTML = '';
                        mutation.target.textContent = '';
                    }
                }
            });
        });

        // Start observing all widget contents
        setTimeout(() => {
            const widgets = document.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                observer.observe(widget, {
                    childList: true,
                    characterData: true,
                    subtree: true
                });
            });
        }, 1000);
    }

    lockMapView() {
        this.isMapViewLocked = true;
    }

    unlockMapView() {
        if (this.isMapViewLocked) {
        }
        this.isMapViewLocked = false;
    }

    /**
     * Initialize components
     */
    async initComponents() {

        // Map Fullscreen Component
        this.mapFullscreen = new MapFullscreen();
        this.mapFullscreen.init();

        // Dashboard Grid Component
        this.dashboardGrid = new DashboardGrid();
        this.dashboardGrid.init();
    }

    /**
     * Setup routes
     */
    setupRoutes() {
        // Map route (fullscreen map)
        this.router.register('/map', () => {
            this.showMapView();
        });

        // Dashboard route
        this.router.register('/dashboard', (params) => {
            this.showDashboardView(params.screens);
        });

        // Detail route
        this.router.register('/detail', (params) => {
            this.showDetailView(params || {});
        });

        // Set route change hooks
        this.router.setBeforeRouteChange((from, to, params) => {
            return true;
        });

        this.router.setAfterRouteChange((from, to) => {
            this.currentView = to.path.replace('/', '');
        });
    }

    /**
     * Bind application events
     */
    bindEvents() {
        // API data updates
        this.apiService.onDataUpdate((screens) => {
            this.handleAPIUpdate(screens);
        });

        // View change events
        window.addEventListener('viewChange', (e) => {
            this.handleViewChange(e.detail);
        });

        // Open detail event
        window.addEventListener('openScreenDetail', (e) => {
            this.handleOpenDetail(e.detail);
        });

        // Navigate back event
        window.addEventListener('navigateBack', (e) => {
            this.handleNavigateBack(e.detail);
        });

        // Handle Tizen hardware keys
        if (Config.isTizen()) {
            document.addEventListener('tizenhwkey', (e) => {
                this.handleTizenKey(e);
            });
        }
    }

    /**
     * Start application
     */
    async start() {

        // Step 1: Show map fullscreen immediately
        this.router.navigate('/map');

        // Step 2: Start API polling after delay
        setTimeout(() => {
            this.apiService.startPolling(Config.API.POLLING_INTERVAL);
        }, 2000);

        // For testing: check URL hash
        if (window.location.hash === '#dashboard') {
            setTimeout(() => {
                // Force show dashboard with mock data
                const mockScreens = [
                    { STT: 0, TenManHinh: "M0: Màn hình Bản đồ", isActive: true, LoaiManHinh: "map" },
                    { STT: 4, TenManHinh: "M4: Màn hình bản đồ đường ống", isActive: true },
                    { STT: 5, TenManHinh: "M5: Màn hình thông tin điểm chảy", isActive: true },
                    { STT: 6, TenManHinh: "M6: Màn hình lắp đặt mới", isActive: true },
                    { STT: 8, TenManHinh: "M8: Màn hình chỉ số đồng hồ", isActive: true },
                    { STT: 9, TenManHinh: "M9: Màn hình công nợ", isActive: true }
                ];
                this.handleAPIUpdate(mockScreens);
            }, 1500);
        }
    }

    /**
     * Handle API update
     */
    handleAPIUpdate(screens) {

        // Add M0 (map screen) to the beginning if there are active screens
        if (screens.length > 0) {
            const m0Screen = {
                STT: 0,
                TenManHinh: "Màn hình Bản đồ",
                isActive: true,
                MaManHinh: "M0",
                LoaiManHinh: "map",
                Data: {},
                Layout: null,
                Theme: null
            };

            // Check if M0 already exists
            const hasM0 = screens.some(s => s.STT === 0);
            if (!hasM0) {
                screens.unshift(m0Screen); // Add M0 to the beginning
            }
        }

        // Update screen manager
        this.screenManager.updateActiveScreens(screens);

        // Decision logic
        const shouldSwitchToDashboard = screens.length > 0 && this.currentView === 'map' && !this.isMapViewLocked;

        // Auto switch view based on screens
        if (shouldSwitchToDashboard) {
            // Have active screens, switch to dashboard
            this.unlockMapView();
            setTimeout(() => {
                this.router.navigate('/dashboard', { screens });
            }, Config.LAYOUT.TRANSITION_DURATION);
        } else if (screens.length === 0 && this.currentView === 'dashboard') {
            // No active screens, switch back to map
            this.router.navigate('/map');
        } else if (this.currentView === 'dashboard') {
            // Update dashboard with new screens
            this.dashboardGrid.render(screens);
        }
    }

    /**
     * Handle view change
     */
    handleViewChange(detail) {
        const { view } = detail;

        // Prevent recursion: if already on dashboard, don't navigate again
        // This stops the loop: showDashboardView -> dispatchEvent -> handleViewChange -> navigate -> showDashboardView
        if (view === 'dashboard' && this.currentView === 'dashboard') {
            return;
        }

        switch (view) {
            case 'map':
                this.router.navigate('/map');
                break;
            case 'dashboard':
                this.unlockMapView();
                this.router.navigate('/dashboard', {
                    screens: detail.screens || this.screenManager.getActiveScreens()
                });
                break;
            case 'detail':
                if (detail.screen) {
                    this.router.navigate('/detail', { screen: detail.screen });
                }
                break;
        }
    }

    /**
     * Handle open detail - Simplified version using Routes
     */
    handleOpenDetail(detail) {

        const providedScreen = detail?.screen;
        const sttValue = Number(detail?.stt ?? providedScreen?.STT);

        // Kiểm tra xem màn hình có tồn tại trong Routes không
        if (this.routes.hasScreen(sttValue)) {
            // Sử dụng hệ thống Routes mới đơn giản
            this.routes.navigate(sttValue, { screen: providedScreen });
            this.currentView = 'detail';
        } else {
            // Fallback to old system for screens not in Routes
            let targetScreen = providedScreen;
            if (!targetScreen && !Number.isNaN(sttValue)) {
                targetScreen = this.screenManager.getActiveScreens()
                    .find(s => Number(s.STT) === sttValue);
            }

            if (!targetScreen) {
                return;
            }

            const isChiTietDiemChay = Number(targetScreen.STT) === 5;
            this.router.navigate('/detail', {
                screen: targetScreen,
                view: isChiTietDiemChay ? 'chiTietDiemChay' : 'defaultDetail'
            });
        }
    }

    /**
     * Handle navigate back - Simplified version
     */
    handleNavigateBack(detail) {

        // Ưu tiên sử dụng Routes mới nếu đang trong detail view
        if (this.routes.getCurrentScreen()) {
            this.navigationManager.handleBack();
            this.unlockMapView();
            // Luôn quay về dashboard với hệ thống 2 cấp mới
            this.currentView = 'dashboard';
        } else {
            // Fallback to old system
            if (detail.to === 'dashboard') {
                this.unlockMapView();
                this.router.navigate('/dashboard', {
                    screens: this.screenManager.getActiveScreens()
                });
            } else if (detail.to === 'map') {
                this.lockMapView();
                this.router.navigate('/map');
            } else {
                this.router.back();
            }
        }
    }

    /**
     * Handle Tizen hardware keys - Simplified
     */
    handleTizenKey(event) {
        switch (event.keyName) {
            case 'back':
                // Kiểm tra nếu đang dùng Routes system
                if (this.routes.getCurrentScreen()) {
                    this.navigationManager.handleBack();
                } else if (this.currentView === 'detail') {
                    this.handleNavigateBack({ to: 'dashboard' });
                } else if (this.currentView === 'dashboard') {
                    this.handleNavigateBack({ to: 'map' });
                } else {
                    // Exit app
                    try {
                        window.tizen.application.getCurrentApplication().exit();
                    } catch (e) {
                    }
                }
                break;
            case 'menu':
                // Handle menu key if needed
                break;
        }
    }

    /**
     * Show map view
     */
    showMapView() {
        this.hideLoading();

        // Hide dashboard container
        const dashboardContainer = document.getElementById('dashboard-container');
        if (dashboardContainer) {
            dashboardContainer.style.display = 'none';
            dashboardContainer.classList.remove('active');
        }

        // Hide detail container
        this.hideDetailView(true);

        // Show map container
        const mapContainer = document.getElementById('map-fullscreen-container');
        if (mapContainer) {
            mapContainer.style.display = 'block';
            // Force reflow for smooth transition
            mapContainer.offsetHeight;
            mapContainer.classList.add('active');
        }

        this.dashboardGrid.hide();
        this.mapFullscreen.show();
        this.navigationManager.currentView = 'map';
        this.currentView = 'map';
    }

    /**
     * Show dashboard view
     */
    showDashboardView(screens) {
        this.unlockMapView();

        // Don't redirect to map if M0 is with other screens
        // Only redirect if ONLY M0 exists and no other screens
        const nonM0Screens = screens ? screens.filter(s => s.STT !== 0) : [];
        if (screens && screens.length === 1 && screens[0].STT === 0 && nonM0Screens.length === 0) {
            this.showMapView();
            return;
        }

        this.hideLoading();
        this.mapFullscreen.hide();
        this.hideDetailView(true);

        // Ensure dashboard container is visible
        const dashboardContainer = document.getElementById('dashboard-container');
        if (dashboardContainer) {
            dashboardContainer.style.display = 'block';
            // Force reflow for smooth transition
            dashboardContainer.offsetHeight;
            dashboardContainer.classList.add('active');
        }

        this.dashboardGrid.show();
        this.dashboardGrid.render(screens || []);

        // Đảm bảo NavigationManager biết đang ở dashboard view
        this.navigationManager.currentView = 'dashboard';
        this.currentView = 'dashboard';

        // Dispatch viewChange event để đảm bảo sync state
        window.dispatchEvent(new CustomEvent('viewChange', {
            detail: { view: 'dashboard', screens }
        }));

        Config.log('debug', 'Dashboard view shown, currentView set to dashboard');
    }

    /**
     * Show detail view
     * @param {Object} params
     * @param {Object} params.screen
     * @param {string} params.view
     */
    showDetailView(params = {}) {
        const { screen = null, view = 'defaultDetail' } = params;
        this.unlockMapView();

        this.hideLoading();
        this.mapFullscreen.hide();
        this.dashboardGrid.hide();

        const detailContainer = document.getElementById('detail-container');
        if (!detailContainer) {
            return;
        }

        // Clear all widget contents first
        const widgets = detailContainer.querySelectorAll('.widget-content');
        widgets.forEach(widget => {
            widget.innerHTML = '';
            widget.textContent = '';
        });

        detailContainer.style.display = 'block';
        // Force reflow for smooth transition
        detailContainer.offsetHeight;
        detailContainer.classList.add('active');

        const titleElement = detailContainer.querySelector('#detail-title');
        if (titleElement) {
            titleElement.textContent = screen?.TenManHinh || 'Chi tiet man hinh';
        }

        if (view === 'chiTietDiemChay' || Number(screen?.STT) === 5) {
            this.renderChiTietDiemChayView(detailContainer);
        } else {
            this.renderDefaultDetailView(detailContainer, screen);
        }

        this.navigationManager.currentView = 'detail';
        this.currentView = 'detail';
    }

    /**
     * Hide detail view
     * @param {boolean} immediate
     */
    hideDetailView(immediate = false) {
        const detailContainer = document.getElementById('detail-container');
        if (!detailContainer) {
            return;
        }

        const detailContent = detailContainer.querySelector('.detail-content');
        if (detailContent) {
            const customView = detailContent.querySelector('#chi-tiet-diem-chay-view');
            if (customView) {
                customView.style.display = 'none';
            }

            const widgetGrid = detailContent.querySelector('.widget-grid');
            if (widgetGrid) {
                // Clear all widget contents when hiding
                const widgets = widgetGrid.querySelectorAll('.widget-content');
                widgets.forEach(widget => {
                    widget.innerHTML = '';
                    widget.textContent = '';
                });
                widgetGrid.style.display = 'grid';
            }
        }

        detailContainer.classList.remove('active');
        if (immediate) {
            detailContainer.style.display = 'none';
            return;
        }

        const transition = Config?.LAYOUT?.TRANSITION_DURATION ?? 0;
        setTimeout(() => {
            detailContainer.style.display = 'none';
        }, transition);
    }

    /**
     * Render ChiTietDiemChay view
     * @param {HTMLElement} detailContainer
     */
    renderChiTietDiemChayView(detailContainer) {
        const detailContent = detailContainer.querySelector('.detail-content');
        if (!detailContent) {
            return;
        }

        const widgetGrid = detailContent.querySelector('.widget-grid');
        if (widgetGrid) {
            // Clear all widget contents before hiding
            const widgets = widgetGrid.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
                widget.textContent = '';
            });
            widgetGrid.style.display = 'none';
        }

        let customView = detailContent.querySelector('#chi-tiet-diem-chay-view');
        if (!customView) {
            customView = document.createElement('div');
            customView.id = 'chi-tiet-diem-chay-view';
            customView.className = 'detail-custom-view';
            detailContent.appendChild(customView);
        }

        customView.style.display = 'block';

        let iframe = customView.querySelector('iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.className = 'detail-iframe';
            iframe.title = 'Chi tiet diem chay';
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'true');
            customView.appendChild(iframe);
        }

        iframe.src = 'ChiTietDiemChay.html';
    }

    /**
     * Render default detail view
     * @param {HTMLElement} detailContainer
     * @param {Object} screen
     */
    renderDefaultDetailView(detailContainer, screen) {
        const detailContent = detailContainer.querySelector('.detail-content');
        if (!detailContent) {
            return;
        }

        const widgetGrid = detailContent.querySelector('.widget-grid');
        if (widgetGrid) {
            // Clear all widget contents before showing
            const widgets = widgetGrid.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
                widget.textContent = '';
            });
            widgetGrid.style.display = 'grid';
        }

        const customView = detailContent.querySelector('#chi-tiet-diem-chay-view');
        if (customView) {
            customView.style.display = 'none';
        }

    }

    /**
     * Show loading screen
     */
    showLoading() {
        const loadingEl = document.getElementById('app-loading');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
        const loadingEl = document.getElementById('app-loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.getElementById('app-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Destroy application
     */
    destroy() {

        // Stop services
        this.apiService?.stopPolling();
        this.apiService?.reset();

        // Destroy components
        this.mapFullscreen?.destroy();
        this.dashboardGrid?.destroy();

        // Reset managers
        this.screenManager?.reset();
        this.navigationManager?.destroy();

        // Clear router
        this.router?.clear();

        this.isInitialized = false;
        this.isMapViewLocked = false;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create global app instance
    window.app = new App();

    // Initialize application
    window.app.init().catch(error => {
        console.error('Failed to initialize app:', error);
    });
});

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
} else {
    window.App = App;
}
