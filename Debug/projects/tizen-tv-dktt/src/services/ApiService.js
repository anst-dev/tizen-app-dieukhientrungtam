/**
 * ApiService.js - Service quản lý việc gọi API
 */

class ApiService {
    constructor() {
        this.baseUrl = Config.API.BASE_URL;
        this.endpoints = Config.API.ENDPOINTS;
        this.pollingInterval = null;
        this.callbacks = [];
        this.lastResponse = null;
        this.errorCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Gọi API GetActiveDisplay
     * @returns {Promise<Array>} Danh sách màn hình active
     */
    async getActiveDisplay() {
        try {
            const url = `${this.baseUrl}${this.endpoints.GET_ACTIVE_DISPLAY}`;


            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',   
                     'ngrok-skip-browser-warning': 'true'
                },
                timeout: Config.API.TIMEOUT
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Kiểm tra format dữ liệu trả về
            if (!data || !data.result || !Array.isArray(data.result)) {
                console.error('❌ Invalid API response format:', data);
                return [];
            }
            

            // Lọc chỉ lấy các màn hình active
            const activeScreens = data.result
                .filter(item => item.isActive === true || item.isActive === 1)
                .map(item => ({
                    STT: item.stt || item.soThuTu || item.STT || 0,
                    TenManHinh: item.tenManHinh || item.TenManHinh || 'Không có tên',
                    isActive: true,
                    MaManHinh: item.maHienThiDieuKhienTrungTam || item.maManHinh || item.MaManHinh || null,
                    LoaiManHinh: item.loaiManHinh || item.LoaiManHinh || null,
                    Data: item.data || item.Data || {},
                    Layout: item.layout,
                    Theme: item.theme,
                    NguoiCapQuyen: item.nguoiCapQuyen
                }))
                .sort((a, b) => a.STT - b.STT);


            this.errorCount = 0; // Reset error count on success
            this.lastResponse = activeScreens;

            return activeScreens;

        } catch (error) {
            this.errorCount++;

            // Nếu lỗi quá nhiều lần, trả về response cuối cùng hoặc ar1ray rỗng
            if (this.errorCount > this.maxRetries) {
                return this.lastResponse || [];
            }

            // Thử lại sau một khoảng thời gian
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(this.getActiveDisplay());
                }, 1000 * this.errorCount); // Tăng delay theo số lần lỗi
            });
        }
    }

    /**
     * Bắt đầu polling API
     * @param {number} interval - Khoảng thời gian polling (ms)
     */
    startPolling(interval = Config.API.POLLING_INTERVAL) {
        // Clear existing polling if any
        this.stopPolling();


        // Gọi lần đầu tiên ngay lập tức
        this.pollAPI();

        // Set interval cho các lần tiếp theo
        this.pollingInterval = setInterval(() => {
            this.pollAPI();
        }, interval);
    }

    /**
     * Dừng polling API
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Poll API một lần
     */
    async pollAPI() {
        try {
            const activeScreens = await this.getActiveDisplay();

            // Notify all callbacks
            this.callbacks.forEach(callback => {
                if (typeof callback === 'function') {
                    callback(activeScreens);
                }
            });

        } catch (error) {
        }
    }

    /**
     * Đăng ký callback khi có dữ liệu mới
     * @param {Function} callback - Function sẽ được gọi khi có dữ liệu
     */
    onDataUpdate(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }

    /**
     * Hủy đăng ký callback
     * @param {Function} callback - Function cần hủy
     */
    offDataUpdate(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }

    /**
     * Clear tất cả callbacks
     */
    clearCallbacks() {
        this.callbacks = [];
    }

    /**
     * Test API với dữ liệu giả
     * @param {Array} mockData - Dữ liệu giả để test
     */
    testWithMockData(mockData) {

        this.callbacks.forEach(callback => {
            if (typeof callback === 'function') {
                callback(mockData);
            }
        });
    }

    /**
     * Get last API response
     * @returns {Array|null} Last response or null
     */
    getLastResponse() {
        return this.lastResponse;
    }

    /**
     * Kiểm tra connection status
     * @returns {boolean} True nếu đang kết nối tốt
     */
    isConnected() {
        return this.errorCount === 0 && this.lastResponse !== null;
    }

    /**
     * Reset service về trạng thái ban đầu
     */
    reset() {
        this.stopPolling();
        this.clearCallbacks();
        this.lastResponse = null;
        this.errorCount = 0;
    }
}

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
} else {
    window.ApiService = ApiService;
}
