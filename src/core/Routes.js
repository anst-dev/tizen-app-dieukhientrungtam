/**
 * Routes.js - Hệ thống điều hướng đơn giản dựa trên STT
 */

class Routes {
    constructor() {
        // Định nghĩa tất cả màn hình có sẵn (M0 - M11)
        this.SCREENS = {
            0: {
                name: 'Bản đồ toàn màn hình',
                type: 'component',
                component: 'MapFullscreen'
            },
            1: {
                name: 'Vận hành NMN Hưng Nguyên',
                type: 'iframe',
                url: 'screens/van-hanh-nmn-hung-nguyen.html'
            },
            2: {
                name: 'Vận hành NMN Cầu Bạch',
                type: 'iframe',
                url: 'screens/van-hanh-nmn-cau-bach.html'
            },
            3: {
                name: 'Trạm bơm tăng áp',
                type: 'iframe',
                url: 'screens/tram-bom-tang-ap.html'
            },
            4: {
                name: 'Bản đồ đường ống, SCADA',
                type: 'iframe',
                url: 'screens/M4banDoDuongOng.html'
            },
            5: {
                name: 'Chi tiết điểm chảy',
                type: 'iframe',
                url: 'screens/M5thongTinDiemChay.html'
            },
            6: {
                name: 'Lắp đặt mới, thay đồng hồ',
                type: 'iframe',
                url: 'screens/M6thongTinLapDatMoiThayTheDongHo.html'
            },
            7: {
                name: 'Tiến độ thi công đường ống',
                type: 'iframe',
                url: 'screens/M7thongTinTienDoThiCongMangDuongOngCap12.html'
            },
            8: {
                name: 'Ghi chỉ số đồng hồ',
                type: 'iframe',
                url: 'screens/M8thongTinKetQuaGhiChiSoDongHo.html'
            },
            9: {
                name: 'Công nợ',
                type: 'iframe',
                url: 'screens/M9thongTinKetQuaCongNo.html'
            },
            10: {
                name: 'Thất thoát DMA',
                type: 'iframe',
                url: 'screens/M10thongTinTyLeThaThoatCacDMA.html'
            },
            11: {
                name: 'Chất lượng nước',
                type: 'iframe',
                url: 'screens/M11thongTinChatLuongNuoc.html'
            }
        };

        // Chỉ lưu màn hình hiện tại
        this.currentScreen = null;

        // Container elements
        this.mapContainer = null;
        this.dashboardContainer = null;
        this.detailContainer = null;
    }

    /**
     * Khởi tạo routes
     */
    init() {
        // Lấy các container
        this.mapContainer = document.getElementById('map-fullscreen-container');
        this.dashboardContainer = document.getElementById('dashboard-container');
        this.detailContainer = document.getElementById('detail-container');

    }

    /**
     * Navigate đến màn hình theo STT
     * @param {number} stt - Số thứ tự màn hình
     * @param {Object} options - Các tùy chọn bổ sung
     */
    navigate(stt, options = {}) {
        const screen = this.SCREENS[stt];

        if (!screen) {
            return false;
        }


        // Clear all widget contents before navigating
        if (this.detailContainer) {
            const widgets = this.detailContainer.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
                widget.textContent = '';
            });
        }

        // Chỉ lưu màn hình hiện tại
        this.currentScreen = stt;

        // Render màn hình tương ứng
        this.renderScreen(screen, options);

        // Dispatch event
        window.dispatchEvent(new CustomEvent('routeChanged', {
            detail: {
                stt,
                screen,
                from: null
            }
        }));

        return true;
    }

    /**
     * Clear nội dung detail container
     */
    clearDetailContent() {
        if (!this.detailContainer) return;

        // Clear tất cả widget contents
        const widgets = this.detailContainer.querySelectorAll('.widget-content');
        widgets.forEach(widget => {
            widget.innerHTML = '';
        });

        // Remove iframe container hoàn toàn
        const iframeContainer = this.detailContainer.querySelector('#iframe-container');
        if (iframeContainer) {
            iframeContainer.remove();
        }

        // Reset widget grid display
        const widgetGrid = this.detailContainer.querySelector('.widget-grid');
        if (widgetGrid) {
            widgetGrid.style.display = '';
        }
    }

    /**
     * Render màn hình
     * @param {Object} screen - Thông tin màn hình
     * @param {Object} options - Các options
     */
    renderScreen(screen, options = {}) {
        // Clear nội dung detail trước
        this.clearDetailContent();

        // Ẩn tất cả container
        this.hideAllContainers();

        if (screen.type === 'component') {
            // Render component (chỉ có Map hiện tại)
            this.renderComponent(screen, options);
        } else if (screen.type === 'iframe') {
            // Render iframe cho màn hình chi tiết
            this.renderIframe(screen, options);
        }
    }

    /**
     * Render component
     * @param {Object} screen - Thông tin màn hình
     * @param {Object} options - Options
     */
    renderComponent(screen, options) {
        if (screen.component === 'MapFullscreen') {
            // Hiển thị map container
            if (this.mapContainer) {
                this.mapContainer.style.display = 'block';
                // Force reflow trước khi add class active
                this.mapContainer.offsetHeight;
                this.mapContainer.classList.add('active');
            }

            // Gọi component MapFullscreen nếu có
            if (window.app && window.app.mapFullscreen) {
                window.app.mapFullscreen.show();
            }

        }
    }

    /**
     * Render iframe cho màn hình chi tiết
     * @param {Object} screen - Thông tin màn hình
     * @param {Object} options - Options
     */
    renderIframe(screen, options) {
        if (!this.detailContainer) {
            return;
        }

        // Hiển thị detail container
        this.detailContainer.style.display = 'block';
        // Force reflow trước khi add class active
        this.detailContainer.offsetHeight;
        this.detailContainer.classList.add('active');

        // Update title
        const titleElement = this.detailContainer.querySelector('#detail-title');
        if (titleElement) {
            titleElement.textContent = screen.name;
        }

        // Clear và ẩn widget grid
        const widgetGrid = this.detailContainer.querySelector('.widget-grid');
        if (widgetGrid) {
            // Clear nội dung của tất cả widgets trước
            const widgets = widgetGrid.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
            });
            widgetGrid.style.display = 'none';
        }

        // Remove iframe cũ nếu có và tạo mới
        let iframeContainer = this.detailContainer.querySelector('#iframe-container');
        if (iframeContainer) {
            iframeContainer.remove();
        }

        // Tạo iframe container mới
        iframeContainer = null;
        if (!iframeContainer) {
            const detailContent = this.detailContainer.querySelector('.detail-content');
            if (detailContent) {
                iframeContainer = document.createElement('div');
                iframeContainer.id = 'iframe-container';
                iframeContainer.className = 'detail-iframe-container';
                detailContent.appendChild(iframeContainer);
            }
        }

        if (iframeContainer) {
            iframeContainer.style.display = 'block';
            iframeContainer.innerHTML = `
                <iframe 
                    src="${screen.url}"
                    class="detail-iframe"
                    frameborder="0"
                    allowfullscreen="true"
                    title="${screen.name}">
                </iframe>
            `;
        }

    }

    /**
     * Navigate back - luôn quay về Dashboard
     */
    back() {
        // Clear detail container content trước
        if (this.detailContainer) {
            // Clear all widget contents
            const widgets = this.detailContainer.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
            });

            // Remove iframe container completely
            const iframeContainer = this.detailContainer.querySelector('#iframe-container');
            if (iframeContainer) {
                iframeContainer.remove();
            }

            // Show widget grid again
            const widgetGrid = this.detailContainer.querySelector('.widget-grid');
            if (widgetGrid) {
                widgetGrid.style.display = '';
            }
        }

        // Luôn quay về Dashboard - hệ thống 2 cấp đơn giản
        this.hideAllContainers();

        // Đợi một chút để animation hoàn tất
        setTimeout(() => {
            // Hiển thị Dashboard
            if (this.dashboardContainer) {
                this.dashboardContainer.style.display = 'block';
                // Force reflow trước khi add class active
                this.dashboardContainer.offsetHeight;
                this.dashboardContainer.classList.add('active');
            }

            // Render lại Dashboard Grid
            if (window.app && window.app.dashboardGrid) {
                window.app.dashboardGrid.show();
                const screens = window.app.screenManager?.getActiveScreens() || [];
                window.app.dashboardGrid.render(screens);
            }

        }, 50);

        // Reset màn hình hiện tại
        this.currentScreen = null;
    }

    /**
     * Ẩn tất cả containers
     */
    hideAllContainers() {
        // Remove active class trước
        if (this.mapContainer) {
            this.mapContainer.classList.remove('active');
        }

        if (this.dashboardContainer) {
            this.dashboardContainer.classList.remove('active');
        }

        if (this.detailContainer) {
            this.detailContainer.classList.remove('active');

            // Clear widget contents
            const widgets = this.detailContainer.querySelectorAll('.widget-content');
            widgets.forEach(widget => {
                widget.innerHTML = '';
            });

            // Reset widget grid display
            const widgetGrid = this.detailContainer.querySelector('.widget-grid');
            if (widgetGrid) {
                widgetGrid.style.display = '';
            }

            // Remove iframe container completely
            const iframeContainer = this.detailContainer.querySelector('#iframe-container');
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
            if (this.mapContainer) {
                this.mapContainer.style.display = 'none';
            }

            if (this.dashboardContainer) {
                this.dashboardContainer.style.display = 'none';
            }

            if (this.detailContainer) {
                this.detailContainer.style.display = 'none';
            }
        }, 10);
    }

    /**
     * Lấy thông tin màn hình hiện tại
     */
    getCurrentScreen() {
        if (this.currentScreen !== null) {
            return {
                stt: this.currentScreen,
                ...this.SCREENS[this.currentScreen]
            };
        }
        return null;
    }

    /**
     * Kiểm tra màn hình có tồn tại không
     * @param {number} stt - STT màn hình
     */
    hasScreen(stt) {
        return this.SCREENS.hasOwnProperty(stt);
    }

    /**
     * Lấy danh sách tất cả màn hình
     */
    getAllScreens() {
        return Object.entries(this.SCREENS).map(([stt, screen]) => ({
            stt: parseInt(stt),
            ...screen
        }));
    }

    /**
     * Reset routes
     */
    reset() {
        this.currentScreen = null;
        this.hideAllContainers();
    }
}

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Routes;
} else {
    window.Routes = Routes;
}
