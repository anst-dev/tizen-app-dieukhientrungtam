/**
 * ScreenManager.js - Quản lý logic hiển thị màn hình
 */

class ScreenManager {
    constructor() {
        this.activeScreens = [];
        this.currentView = 'map'; // 'map' hoặc 'dashboard'
        this.screenElements = new Map();
        this.focusedScreenIndex = -1;
    }

    /**
     * Khởi tạo ScreenManager
     */
    init() {
        Config.log('info', 'Initializing ScreenManager');
        this.setupScreenElements();
        this.currentView = 'map'; // Mặc định hiển thị bản đồ toàn màn hình
    }

    /**
     * Setup các screen elements
     */
    setupScreenElements() {
        for (let i = 1; i <= Config.DISPLAY.MAX_SCREENS; i++) {
            const element = document.getElementById(`screen-${i}`);
            if (element) {
                this.screenElements.set(i, element);
            }
        }
        Config.log('debug', `Setup ${this.screenElements.size} screen elements`);
    }

    /**
     * Cập nhật danh sách màn hình active từ API
     * @param {Array} screens - Danh sách màn hình từ API
     */
    updateActiveScreens(screens) {
        // Lọc và sắp xếp màn hình theo STT
        this.activeScreens = screens
            .filter(s => s.isActive)
            .sort((a, b) => a.STT - b.STT);
        
        
        // Trigger event để các component khác biết có thay đổi
        this.dispatchScreensUpdate();
    }

    /**
     * Tính toán layout cho màn hình
     * @returns {Object} Layout configuration
     */
    calculateLayout() {
        const screenCount = this.activeScreens.length;
        
        if (screenCount === 0) {
            return {
                type: 'fullscreen',
                columns: 1,
                rows: 1,
                flexBasis: '100%'
            };
        }

        // Tính toán số cột và hàng tối ưu
        let columns, rows;
        
        if (screenCount <= 1) {
            columns = 1;
            rows = 1;
        } else if (screenCount <= 2) {
            columns = 2;
            rows = 1;
        } else if (screenCount <= 4) {
            columns = 2;
            rows = 2;
        } else if (screenCount <= 6) {
            columns = 3;
            rows = 2;
        } else if (screenCount <= 9) {
            columns = 3;
            rows = 3;
        } else {
            columns = 4;
            rows = Math.ceil(screenCount / 4);
        }

        // Tính flexBasis để lấp đầy màn hình
        const flexBasis = this.calculateFlexBasis(screenCount, columns, rows);

        return {
            type: 'grid',
            columns,
            rows,
            flexBasis,
            screenCount
        };
    }

    /**
     * Tính toán flex basis để màn hình lấp đầy
     */
    calculateFlexBasis(count, columns, rows) {
        // Tính số ô trống
        const totalCells = columns * rows;
        const emptyCells = totalCells - count;
        
        if (emptyCells === 0) {
            // Không có ô trống, chia đều
            return `${100 / columns}%`;
        }
        
        // Có ô trống, tính toán để lấp đầy
        if (count <= columns) {
            // Chỉ có 1 hàng
            return `${100 / count}%`;
        }
        
        // Nhiều hàng, chia theo cột
        return `${100 / columns}%`;
    }

    /**
     * Chuyển sang view bản đồ toàn màn hình
     */
    switchToMapView() {
        this.currentView = 'map';
        Config.log('info', 'Switched to map fullscreen view');
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('viewChange', {
            detail: { view: 'map' }
        }));
    }

    /**
     * Chuyển sang view dashboard
     */
    switchToDashboardView() {
        this.currentView = 'dashboard';
        Config.log('info', 'Switched to dashboard view');
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('viewChange', {
            detail: { view: 'dashboard', screens: this.activeScreens }
        }));
    }

    /**
     * Tự động quyết định view dựa trên số màn hình active
     */
    autoSwitchView() {
        if (this.activeScreens.length > 0) {
            if (this.currentView !== 'dashboard') {
                this.switchToDashboardView();
            }
        } else {
            if (this.currentView !== 'map') {
                this.switchToMapView();
            }
        }
    }

    /**
     * Focus vào một màn hình
     * @param {number} screenIndex - Index của màn hình trong activeScreens
     */
    focusScreen(screenIndex) {
        if (screenIndex < 0 || screenIndex >= this.activeScreens.length) {
            return false;
        }

        this.focusedScreenIndex = screenIndex;
        const screen = this.activeScreens[screenIndex];
        
        // Dispatch focus event
        window.dispatchEvent(new CustomEvent('screenFocus', {
            detail: { 
                screenIndex,
                screen,
                STT: screen.STT
            }
        }));

        Config.log('debug', `Focused on screen ${screenIndex} (STT: ${screen.STT})`);
        return true;
    }

    /**
     * Di chuyển focus theo hướng
     * @param {string} direction - 'up', 'down', 'left', 'right'
     */
    moveFocus(direction) {
        if (this.currentView !== 'dashboard' || this.activeScreens.length === 0) {
            return false;
        }

        const layout = this.calculateLayout();
        const currentIndex = this.focusedScreenIndex;
        
        if (currentIndex < 0) {
            // Chưa có focus, focus vào màn hình đầu tiên
            return this.focusScreen(0);
        }

        const currentRow = Math.floor(currentIndex / layout.columns);
        const currentCol = currentIndex % layout.columns;
        let newIndex = currentIndex;

        switch (direction) {
            case 'up':
                if (currentRow > 0) {
                    newIndex = (currentRow - 1) * layout.columns + currentCol;
                }
                break;
            case 'down':
                if (currentRow < layout.rows - 1) {
                    const nextIndex = (currentRow + 1) * layout.columns + currentCol;
                    if (nextIndex < this.activeScreens.length) {
                        newIndex = nextIndex;
                    }
                }
                break;
            case 'left':
                if (currentCol > 0) {
                    newIndex = currentIndex - 1;
                }
                break;
            case 'right':
                if (currentCol < layout.columns - 1 && currentIndex + 1 < this.activeScreens.length) {
                    newIndex = currentIndex + 1;
                }
                break;
        }

        if (newIndex !== currentIndex) {
            return this.focusScreen(newIndex);
        }

        return false;
    }

    /**
     * Mở màn hình chi tiết
     * @param {number} screenIndex - Index của màn hình
     */
    openDetailScreen(screenIndex) {
        if (screenIndex < 0 || screenIndex >= this.activeScreens.length) {
            return false;
        }

        const screen = this.activeScreens[screenIndex];
        
        // Dispatch event để mở chi tiết
        window.dispatchEvent(new CustomEvent('openDetail', {
            detail: { 
                screen,
                screenIndex
            }
        }));

        Config.log('info', `Opening detail for screen ${screen.STT}: ${screen.TenManHinh}`);
        return true;
    }

    /**
     * Dispatch event khi screens update
     */
    dispatchScreensUpdate() {
        window.dispatchEvent(new CustomEvent('screensUpdate', {
            detail: {
                screens: this.activeScreens,
                count: this.activeScreens.length,
                layout: this.calculateLayout()
            }
        }));
    }

    /**
     * Get current view
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * Get active screens
     */
    getActiveScreens() {
        return this.activeScreens;
    }

    /**
     * Get focused screen
     */
    getFocusedScreen() {
        if (this.focusedScreenIndex >= 0 && this.focusedScreenIndex < this.activeScreens.length) {
            return this.activeScreens[this.focusedScreenIndex];
        }
        return null;
    }

    /**
     * Reset manager
     */
    reset() {
        this.activeScreens = [];
        this.currentView = 'map';
        this.focusedScreenIndex = -1;
        Config.log('info', 'ScreenManager reset complete');
    }
}

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenManager;
} else {
    window.ScreenManager = ScreenManager;
}
