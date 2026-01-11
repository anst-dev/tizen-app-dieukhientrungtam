/**
 * Config.js - Cấu hình chung cho ứng dụng Tizen Control Room
 */

const Config = {
    // Cấu hình màn hình TV 100 inch
    DISPLAY: {
        DEFAULT_WIDTH: 3840,
        DEFAULT_HEIGHT: 2160,
        MAX_SCREENS: 12,
        GRID_COLUMNS: 4,
        GRID_ROWS: 3,
        ASPECT_RATIO: '16:9'
    },

    // Cấu hình API
    API: {
        // BASE_URL: "https://unsupercilious-leonarda-unreaving.ngrok-free.dev",
        BASE_URL: "http://localhost:44311",
        ENDPOINTS: {
            GET_ACTIVE_DISPLAY: '/api/services/app/HienThiDieuKhienTrungTam/GetActiveDisplays'
        },
        POLLING_INTERVAL: 2000, // 2 giây
        TIMEOUT: 10000 // 10 giây
    },

    // Cấu hình điều hướng
    NAVIGATION: {
        KEYS: {
            UP: ['ArrowUp', '38'],
            DOWN: ['ArrowDown', '40'],
            LEFT: ['ArrowLeft', '37'],
            RIGHT: ['ArrowRight', '39'],
            ENTER: ['Enter', '13'],
            BACK: ['Escape', '27', '10009'] // 10009 là mã phím BACK trên Tizen
        },
        FOCUS_DELAY: 100,
        ANIMATION_DURATION: 300
    },

    // Cấu hình layout
    LAYOUT: {
        // Flex basis cho các số lượng màn hình khác nhau
        FLEX_BASIS: {
            1: '100%',
            2: '50%',
            3: '33.33%',
            4: '50%',
            5: '33.33%',
            6: '33.33%',
            7: '25%',
            8: '25%',
            9: '33.33%',
            10: '33.33%',
            11: '25%',
            12: '25%'
        },
        TRANSITION_DURATION: 500,
        FULLSCREEN_DELAY: 500
    },

    // Cấu hình bản đồ
    MAP: {
        DEFAULT_CENTER: [105.695587, 18.671575],
        DEFAULT_ZOOM: 10,
        FULLSCREEN_ZOOM: 10,
        MIN_ZOOM: 4,
        MAX_ZOOM: 18,
        WIDGET_ZOOM: 14,
        TILE_SOURCE: 'OSM' // OpenStreetMap
    },

    // Cấu hình widget
    WIDGETS: {
        UPDATE_INTERVAL: 5000, // 5 giây
        ANIMATION: {
            FADE_IN: 300,
            FADE_OUT: 200
        },
        DEFAULT_WIDGETS: [
            'StatusWidget',
            'ChartWidget',
            'AlertWidget',
            'InfoWidget'
        ]
    },

    // Cấu hình debug
    DEBUG: {
        ENABLED: true,
        LOG_LEVEL: 'info', // 'error', 'warn', 'info', 'debug'
        SHOW_GRID: false,
        SHOW_NAVIGATION_HINTS: false
    },

    // Auto scale đã được vô hiệu hóa - sử dụng viewport units
    getAutoScale() {
        // Không cần scale - sử dụng vw/vh và rem trong CSS
        return 1.0; // Always return 1
    },

    // Kiểm tra xem có phải môi trường Tizen không
    isTizen() {
        return typeof window.tizen !== 'undefined' && window.tizen;
    },

    // Log với level
    log(level, ...args) {
        if (!this.DEBUG.ENABLED) return;

        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.DEBUG.LOG_LEVEL);
        const messageLevelIndex = levels.indexOf(level);

        if (messageLevelIndex <= currentLevelIndex) {
            console[level](...args);
        }
    }
};

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
} else {
    window.Config = Config;
}
