/**
 * DashboardGrid.js - Component hiển thị grid dashboard với layout động
 */

const SCREEN_PREVIEW_IMAGES = {
    1: 'images/1_VanHanh_HN.png',
    2: 'images/2_VanHanh_CB.png',
    3: 'images/3_Bom_Tang_Ap.png',
    4: 'images/4_Scada.png',
    5: 'images/5_DiemChay.png',
    6: 'images/6_LDM_TDH.png',
    7: 'images/7_TienDoThiCong.png',
    8: 'images/8_GhiChiSo.png',
    9: 'images/9_CongNo.png',
    10: 'images/10_ThatThoat.png',
    11: 'images/11_ChatLuongNuoc.png'
};

const DEFAULT_SCREEN_PREVIEW = 'images/tizen_32.png';

class DashboardGrid {
    constructor(containerId = 'dashboard-container') {
        this.containerId = containerId;
        this.container = null;
        this.screens = [];
        this.currentLayout = null;
        this.screenElements = new Map();
    }

    /**
     * Khởi tạo component
     */
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            return false;
        }

        this.setupContainer();
        this.bindEvents();

        return true;
    }

    /**
     * Setup container HTML cơ bản
     */
    setupContainer() {
        this.container.innerHTML = `
            <div class="dashboard-wrapper">
                <div id="dashboard-grid" class="dashboard-grid">LOADDING</div>
            </div>
        `;
    }

    /**
     * Render dashboard với danh sách màn hình active
     * @param {Array} activeScreens - Danh sách màn hình active từ API
     */
    render(activeScreens) {
        // Sort screens, ensuring M0 comes first
        this.screens = activeScreens.sort((a, b) => {
            // M0 always comes first
            if (a.STT === 0) return -1;
            if (b.STT === 0) return 1;
            // Then sort by STT
            return a.STT - b.STT;
        });

        // Tính toán layout
        this.currentLayout = this.calculateLayout(this.screens.length);

        // Render grid
        this.renderGrid();

        // Update info
        this.updateInfo();
    }

    /**
     * Tính toán layout dựa trên số màn hình
     */
    calculateLayout(screenCount) {
        if (screenCount === 0) {
            return null;
        }

        const GRID_GAP_REM = 0.5;

        let columns = 1;
        let rows = 1;
        let layoutMode = 'flex';
        let flexGrow = 1;

        // Tính số cột và hàng tối ưu để lấp đầy màn hình
        if (screenCount === 1) {
            columns = 1;
            rows = 1;
        } else if (screenCount === 2) {
            columns = 2;
            rows = 1;
        } else if (screenCount === 3) {
            columns = 3;
            rows = 1;
        } else if (screenCount === 4) {
            columns = 2;
            rows = 2;
        } else if (screenCount === 5 || screenCount === 6) {
            columns = 3;
            rows = 2;
        } else if (screenCount === 7) {
            columns = 4;
            rows = 2;
            layoutMode = 'grid-4-2-last3';
        } else if (screenCount === 8) {
            columns = 4;
            rows = 2;
            layoutMode = 'grid-4-2';
        } else if (screenCount === 9) {
            columns = 3;
            rows = 3;
        } else if (screenCount === 10) {
            columns = 4;
            rows = 3;
            layoutMode = 'grid-4-4-2';
        } else if (screenCount === 11) {
            columns = 4;
            rows = 3;
            layoutMode = 'grid-4-4-3';
        } else if (screenCount === 12) {
            columns = 4;
            rows = 3;
            layoutMode = 'grid-4-3';
        } else {
            // Nhiều hơn 12 màn hình
            columns = 4;
            rows = Math.ceil(screenCount / 4);
        }

        const totalCells = columns * rows;
        const emptyCells = totalCells - screenCount;

        if (layoutMode === 'flex' && emptyCells > 0 && screenCount < columns) {
            // Có ô trống và ít hơn 1 hàng đầy
            flexGrow = columns / screenCount;
        }

        let flexBasis = null;
        let cellHeight = null;
        let gridTemplateColumns = null;
        let gridTemplateRows = null;
        let justifyContent = 'flex-start';
        let layoutClass = '';

        if (layoutMode === 'flex') {
            const widthPercent = (100 / columns).toFixed(4);
            const heightPercent = rows > 0 ? (100 / rows).toFixed(4) : '100.0000';
            const horizontalAdjustment = columns > 1 ? ((columns - 1) / columns * GRID_GAP_REM).toFixed(4) : '0';
            const verticalAdjustment = rows > 1 ? ((rows - 1) / rows * GRID_GAP_REM).toFixed(4) : '0';

            flexBasis = columns === 1
                ? '100%'
                : `calc(${widthPercent}% - ${horizontalAdjustment}rem)`;

            cellHeight = rows === 1
                ? '100%'
                : `calc(${heightPercent}% - ${verticalAdjustment}rem)`;

            const itemsOnLastRow = screenCount % columns || columns;
            const hasPartialLastRow = itemsOnLastRow !== columns;
            if (screenCount === 1) {
                justifyContent = 'center';
            } else if (hasPartialLastRow) {
                justifyContent = 'center';
            }
        } else {
            switch (layoutMode) {
                case 'grid-4-2':
                    gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                    gridTemplateRows = 'repeat(2, minmax(0, 1fr))';
                    layoutClass = 'layout-4-2';
                    break;
                case 'grid-4-2-last3':
                    gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                    gridTemplateRows = 'repeat(2, minmax(0, 1fr))';
                    layoutClass = 'layout-4-2-last3';
                    break;
                case 'grid-4-4-2':
                    gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                    gridTemplateRows = 'repeat(3, minmax(0, 1fr))';
                    layoutClass = 'layout-ten';
                    break;
                case 'grid-4-4-3':
                    gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                    gridTemplateRows = 'repeat(3, minmax(0, 1fr))';
                    layoutClass = 'layout-eleven';
                    break;
                case 'grid-4-3':
                    gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                    gridTemplateRows = 'repeat(3, minmax(0, 1fr))';
                    layoutClass = 'layout-4-3';
                    break;
                default:
                    break;
            }
        }

        return {
            columns,
            rows,
            flexBasis,
            flexGrow,
            cellHeight,
            layoutMode,
            gridTemplateColumns,
            gridTemplateRows,
            justifyContent,
            layoutClass,
            screenCount,
            totalCells,
            emptyCells
        };
    }

    /**
     * Render grid với layout đã tính toán
     */
    renderGrid() {
        const gridElement = document.getElementById('dashboard-grid');
        if (!gridElement) return;

        const activeElement = document.activeElement;
        let previousFocusStt = null;

        if (activeElement) {
            let activeTile = null;

            if (activeElement.classList && activeElement.classList.contains('screen-tile')) {
                activeTile = activeElement;
            } else if (typeof activeElement.closest === 'function') {
                activeTile = activeElement.closest('.screen-tile');
            }

            if (activeTile) {
                previousFocusStt = activeTile.getAttribute('data-stt');
            }
        }

        // Clear existing elements
        gridElement.innerHTML = '';
        this.screenElements.clear();

        // Không có màn hình nào -- khôn hiển thị gì hết
        if (!this.currentLayout) {
            gridElement.innerHTML = '<div class="no-screens"></div>';
            return;
        }

        // Set CSS variables cho grid
        gridElement.style.setProperty('--grid-columns', this.currentLayout.columns);
        gridElement.style.setProperty('--grid-rows', this.currentLayout.rows);
        gridElement.setAttribute('data-active', this.screens.length);

        // Render từng màn hình
        this.screens.forEach((screen, index) => {
            const screenElement = this.createScreenElement(screen, index);
            gridElement.appendChild(screenElement);
            this.screenElements.set(screen.STT, screenElement);
        });

        // Apply flex styles
        this.applyFlexLayout();

        this.restoreFocus(previousFocusStt);

        // Auto-focus vào ô đầu tiên sau khi render xong
        // Sử dụng setTimeout để đảm bảo DOM đã được update hoàn toàn
        setTimeout(() => {
            this.autoFocusFirstScreen();
        }, 50);
    }

    /**
     * Auto-focus vào ô màn hình đầu tiên (ưu tiên M0)
     */
    autoFocusFirstScreen() {
        // Ưu tiên focus vào M0 (map screen) nếu tồn tại
        let targetElement = this.container?.querySelector('.screen-tile[data-stt="0"]');

        // Nếu không có M0, focus vào ô đầu tiên
        if (!targetElement) {
            targetElement = this.container?.querySelector('.screen-tile');
        }

        if (targetElement) {
            const navigationManager = window.app?.navigationManager;
            if (navigationManager && typeof navigationManager.moveFocus === 'function') {
                navigationManager.moveFocus(targetElement);
            } else {
                // Fallback: focus trực tiếp
                document.querySelectorAll('.screen-tile.focused').forEach((focusedEl) => {
                    if (focusedEl !== targetElement) {
                        focusedEl.classList.remove('focused');
                    }
                });
                targetElement.focus();
                targetElement.classList.add('focused');
            }
            Config.log('debug', 'Auto-focused to first screen tile:', targetElement);
        }
    }

    /**
     * Tạo element cho một màn hình
     */
    createScreenElement(screen, index) {
        const div = document.createElement('div');
        div.className = 'screen-tile';

        // Add special class for M0 (map screen)
        if (screen.STT === 0) {
            div.className += ' map-screen';
        }

        div.id = `screen-tile-${screen.STT}`;
        div.setAttribute('data-stt', screen.STT);
        div.setAttribute('data-index', index);
        div.setAttribute('tabindex', '0');

        // Navigation attributes cho điều khiển
        this.setNavigationAttributes(div, index);

        const previewImage = this.getScreenPreviewImage(screen.STT);
        const screenTitle = screen.TenManHinh || ('M&#224;n h&#236;nh ' + screen.STT);

        // Special content for M0
        if (screen.STT === 0) {
            div.innerHTML = `
                <div class="screen-tile-header">
                    <span class="screen-number">M${screen.STT}</span>
                    <h3 class="screen-name">Màn hình Bản đồ</h3>
                </div>
                <div class="screen-tile-content">
                    <div class="screen-preview-container">
                        <div class="map-icon">🗺️</div>
                        <p class="map-description">Nhấn để xem bản đồ</p>
                    </div>
                </div>
            `;
        } else {
            div.innerHTML = `
                <div class="screen-tile-header">
                    <span class="screen-number">M${screen.STT}</span>
                    <h3 class="screen-name">${screenTitle}</h3>
                </div>
                <div class="screen-tile-content">
                    <div class="screen-preview-container">
                        <img src="${previewImage}" alt="Preview for ${screenTitle}" class="screen-preview-image"/>
                    </div>
                </div>
            `;
        }

        // Add event listeners
        div.addEventListener('click', () => this.handleScreenClick(screen));
        div.addEventListener('keydown', (e) => this.handleScreenKeydown(e, screen, index));

        return div;
    }

    /**
     * Get preview image path matching screen STT
     */
    getScreenPreviewImage(stt) {
        const numericStt = Number(stt);
        if (!Number.isFinite(numericStt)) {
            return DEFAULT_SCREEN_PREVIEW;
        }

        const imagePath = SCREEN_PREVIEW_IMAGES[numericStt];
        return imagePath || DEFAULT_SCREEN_PREVIEW;
    }

    /**
     * Set navigation attributes cho điều khiển remote
     */
    setNavigationAttributes(element, index) {
        if (!this.currentLayout) return;

        const { columns, rows } = this.currentLayout;
        const row = Math.floor(index / columns);
        const col = index % columns;

        // Calculate neighbors
        const up = row > 0 ? index - columns : -1;

        let down = -1;
        if (row < rows - 1) {
            // Check if direct neighbor below exists
            if (index + columns < this.screens.length) {
                down = index + columns;
            } else {
                // If not (irregular grid), snap to the last item
                down = this.screens.length - 1;
            }
        }
        const left = col > 0 ? index - 1 : -1;
        const right = col < columns - 1 && index + 1 < this.screens.length ? index + 1 : -1;

        const getNeighborStt = (neighborIndex) => {
            if (neighborIndex < 0 || neighborIndex >= this.screens.length) {
                return -1;
            }
            const neighborScreen = this.screens[neighborIndex];
            return typeof neighborScreen !== 'undefined' && typeof neighborScreen.STT !== 'undefined'
                ? neighborScreen.STT
                : -1;
        };

        // Set navigation data
        element.setAttribute('data-nav-up', up);
        element.setAttribute('data-nav-up-stt', getNeighborStt(up));
        element.setAttribute('data-nav-down', down);
        element.setAttribute('data-nav-down-stt', getNeighborStt(down));
        element.setAttribute('data-nav-left', left);
        element.setAttribute('data-nav-left-stt', getNeighborStt(left));
        element.setAttribute('data-nav-right', right);
        element.setAttribute('data-nav-right-stt', getNeighborStt(right));
        element.setAttribute('data-row', row);
        element.setAttribute('data-col', col);
    }

    /**
     * Apply flex layout styles
     */
    applyFlexLayout() {
        if (!this.currentLayout) return;

        const gridElement = document.getElementById('dashboard-grid');
        if (!gridElement) return;

        const {
            flexBasis,
            flexGrow,
            cellHeight,
            layoutMode,
            gridTemplateColumns,
            gridTemplateRows,
            justifyContent,
            layoutClass
        } = this.currentLayout;

        // Reset grid element styles before applying new layout
        gridElement.classList.remove('layout-4-2', 'layout-4-2-last3', 'layout-ten', 'layout-eleven', 'layout-4-3');
        gridElement.style.gridTemplateColumns = '';
        gridElement.style.gridTemplateRows = '';
        gridElement.style.gridAutoFlow = '';
        gridElement.style.justifyContent = '';
        gridElement.style.alignContent = '';
        gridElement.style.alignItems = '';
        gridElement.style.justifyItems = '';
        gridElement.style.flexWrap = '';
        gridElement.style.width = '100%';
        gridElement.style.height = '100%';

        this.screenElements.forEach((element) => {
            element.style.flexBasis = '';
            element.style.flexGrow = '';
            element.style.maxWidth = '';
            element.style.height = '';
            element.style.gridColumn = '';
            element.style.gridRow = '';
        });

        const isGridLayout = layoutMode !== 'flex' && layoutClass;

        if (isGridLayout) {
            gridElement.style.display = 'grid';
            gridElement.style.gridTemplateColumns = gridTemplateColumns;
            gridElement.style.gridTemplateRows = gridTemplateRows;
            gridElement.style.gridAutoFlow = 'row';
            gridElement.style.justifyContent = 'center';
            gridElement.style.alignContent = 'stretch';
            gridElement.style.alignItems = 'stretch';
            gridElement.style.justifyItems = 'stretch';
            gridElement.classList.add(layoutClass);
            return;
        }

        // Apply flex styles to grid
        gridElement.style.display = 'flex';
        gridElement.style.flexWrap = 'wrap';
        gridElement.style.width = '100%';
        gridElement.style.height = '100%';
        gridElement.style.alignContent = 'stretch';
        gridElement.style.justifyContent = justifyContent;

        // Apply styles to each screen tile
        this.screenElements.forEach((element) => {
            element.style.flexBasis = flexBasis;
            element.style.flexGrow = flexGrow;
            element.style.maxWidth = flexBasis;
            element.style.height = cellHeight;
        });
    }

    restoreFocus(previousFocusStt) {
        if (!previousFocusStt && previousFocusStt !== '0') {
            return;
        }

        const targetSelector = `.screen-tile[data-stt="${previousFocusStt}"]`;
        const targetElement = this.container?.querySelector(targetSelector);
        const navigationManager = window.app?.navigationManager;

        const focusWithManager = (element) => {
            if (!element) {
                return;
            }

            if (navigationManager && typeof navigationManager.moveFocus === 'function') {
                navigationManager.moveFocus(element);
            } else {
                document.querySelectorAll('.screen-tile.focused').forEach((focusedEl) => {
                    if (focusedEl !== element) {
                        focusedEl.classList.remove('focused');
                    }
                });
                element.focus();
                element.classList.add('focused');
            }
        };

        if (targetElement) {
            focusWithManager(targetElement);
            return;
        }

        const fallbackElement =
            this.container?.querySelector('.screen-tile.map-screen') ||
            this.container?.querySelector('.screen-tile[data-stt="0"]');

        if (fallbackElement) {
            focusWithManager(fallbackElement);
        }
    }

    /**
     * Handle screen click
     */
    handleScreenClick(screen) {
        // M0 (screen 0) - navigate to map view
        if (screen.STT === 0) {
            if (window.app && window.app.router) {
                if (typeof window.app.lockMapView === 'function') {
                    window.app.lockMapView();
                }
                window.app.router.navigate('/map');
            }
        } else {
            // Other screens - open detail view
            this.openDetailView(screen);
        }
    }

    /**
     * Handle keydown on screen
     */
    handleScreenKeydown(event, screen, index) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.openDetailView(screen);
        }
    }

    /**
     * Open detail view cho màn hình
     */
    openDetailView(screen) {
        window.dispatchEvent(new CustomEvent('openScreenDetail', {
            detail: { screen }
        }));
    }

    /**
     * Static method để mở chi tiết (dùng cho onclick)
     */
    static openDetail(stt) {
        window.dispatchEvent(new CustomEvent('openScreenDetail', {
            detail: { stt }
        }));
    }

    /**
     * Update thông tin dashboard
     */
    updateInfo() {
        const countElement = this.container.querySelector('.active-count');
        if (countElement) {
            countElement.textContent = this.screens.length;
        }
    }

    /**
     * Focus vào một màn hình
     */
    focusScreen(index) {
        const screens = this.container.querySelectorAll('.screen-tile');
        if (screens[index]) {
            screens[index].focus();
            screens[index].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    /**
     * Navigate theo hướng
     */
    navigate(direction, currentIndex) {
        const currentElement = this.container.querySelectorAll('.screen-tile')[currentIndex];
        if (!currentElement) return;

        const navAttr = `data-nav-${direction}`;
        const navIndex = currentElement.getAttribute(navAttr);

        if (navIndex && navIndex !== '-1') {
            const targetIndex = parseInt(navIndex, 10);
            const screens = this.container.querySelectorAll('.screen-tile');
            if (screens[targetIndex]) {
                this.focusScreen(targetIndex);
                return;
            }
        }

        const fallbackStt = currentElement.getAttribute(`${navAttr}-stt`);
        if (fallbackStt && fallbackStt !== '-1') {
            const fallbackElement = this.container.querySelector(`.screen-tile[data-stt="${fallbackStt}"]`);
            if (fallbackElement) {
                fallbackElement.focus();
                fallbackElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }

    /**
     * Bind global events
     */
    bindEvents() {
        // Listen for screen updates
        window.addEventListener('screensUpdate', (e) => {
            if (e.detail && e.detail.screens) {
                this.render(e.detail.screens);
            }
        });
    }

    /**
     * Show dashboard
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.container.classList.add('active');
        }
    }

    /**
     * Hide dashboard
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('active');
            setTimeout(() => {
                this.container.style.display = 'none';
            }, Config.LAYOUT.TRANSITION_DURATION);
        }
    }

    /**
     * Get screen element by STT
     */
    getScreenElement(stt) {
        return this.screenElements.get(stt);
    }

    /**
     * Destroy component
     */
    destroy() {
        this.screenElements.clear();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardGrid;
} else {
    window.DashboardGrid = DashboardGrid;
}

