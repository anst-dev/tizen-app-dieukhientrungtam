/**
 * MapFullscreen.js - Component hiển thị bản đồ toàn màn hình
 */

class MapFullscreen {
    constructor(containerId = 'map-fullscreen-container') {
        this.containerId = containerId;
        this.container = null;
        this.map = null;
        this.isVisible = false;
        this.resizeObserver = null;
    }

    /**
     * Khởi tạo component
     */
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            Config.log('error', `Container ${this.containerId} not found`);
            return false;
        }

        this.setupContainer();
        this.initMap();
        this.setupResizeObserver();

        if (typeof window !== 'undefined') {
            window.mapFullscreen = this;
        }
        
        Config.log('info', 'MapFullscreen component initialized');
        return true;
    }

    /**
     * Setup container HTML
     */
    setupContainer() {
        this.container.innerHTML = `
            <div class="map-fullscreen-wrapper">
                <div class="map-fullscreen-header">
                    <h1 class="map-title">Hệ thống giám sát phòng điều khiển</h1>
                </div>
                <div id="map-fullscreen" class="map-fullscreen"></div>
                <div class="map-fullscreen-overlay" id="map-overlay">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Đang tải bản đồ...</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Khởi tạo bản đồ OpenLayers
     */
    initMap() {
        if (typeof ol === 'undefined') {
            Config.log('error', 'OpenLayers library not loaded');
            return;
        }

        const mapElement = document.getElementById('map-fullscreen');
        if (!mapElement) {
            Config.log('error', 'Map element not found');
            return;
        }

        try {
            this.map = new ol.Map({
                target: mapElement,
                layers: [
                    new ol.layer.Tile({
                        source: new ol.source.OSM({
                            attributions: []
                        })
                    })
                ],
                view: new ol.View({
                    center: ol.proj.fromLonLat(Config.MAP.DEFAULT_CENTER),
                    zoom: Config.MAP.FULLSCREEN_ZOOM,
                    minZoom: typeof Config.MAP.MIN_ZOOM === 'number' ? Config.MAP.MIN_ZOOM : undefined,
                    maxZoom: typeof Config.MAP.MAX_ZOOM === 'number' ? Config.MAP.MAX_ZOOM : undefined
                }),
                controls: [] // Simplified controls for now
            });

            // Ẩn loading overlay sau khi map load
            this.map.once('rendercomplete', () => {
                this.hideLoading();
                this.updateStatus('Kết nối thành công', 'connected');
            });

            Config.log('info', 'Map initialized successfully');
        } catch (error) {
            Config.log('error', 'Failed to initialize map:', error);
            this.updateStatus('Lỗi tải bản đồ', 'error');
        }
    }

    /**
     * Setup resize observer
     */
    setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.map && this.isVisible) {
                    this.map.updateSize();
                    Config.log('debug', 'Map size updated');
                }
            });

            const mapElement = document.getElementById('map-fullscreen');
            if (mapElement) {
                this.resizeObserver.observe(mapElement);
            }
        }

        // Fallback cho window resize
        window.addEventListener('resize', () => {
            if (this.map && this.isVisible) {
                setTimeout(() => {
                    this.map.updateSize();
                }, 100);
            }
        });
    }

    /**
     * Hiển thị bản đồ toàn màn hình
     */
    show() {
        if (!this.container) {
            Config.log('error', 'Container not initialized');
            return;
        }

        this.container.style.display = 'block';
        this.container.classList.add('active');
        this.isVisible = true;

        // Update map size sau khi hiển thị
        if (this.map) {
            setTimeout(() => {
                this.map.updateSize();
                this.animateZoom();
            }, Config.LAYOUT.TRANSITION_DURATION);
        }

    }

    /**
     * Ẩn bản đồ toàn màn hình
     */
    hide() {
        if (!this.container) return;

        this.container.classList.remove('active');
        setTimeout(() => {
            this.container.style.display = 'none';
        }, Config.LAYOUT.TRANSITION_DURATION);
        
        this.isVisible = false;
    }

    /**
     * Toggle hiển thị
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Animate zoom effect
     */
    animateZoom() {
        if (!this.map) return;

        const view = this.map.getView();
        const currentZoom = view.getZoom();
        
        // Zoom out rồi zoom in để tạo hiệu ứng
        view.animate({
            zoom: currentZoom - 1,
            duration: 300
        }, {
            zoom: Config.MAP.FULLSCREEN_ZOOM,
            duration: 500
        });
    }

    /**
     * Thêm markers vào bản đồ
     * @param {Array} markers - Danh sách markers
     */
    addMarkers(markers) {
        if (!this.map) return;

        // Tạo vector layer cho markers
        const vectorSource = new ol.source.Vector();
        
        markers.forEach(marker => {
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(
                    ol.proj.fromLonLat([marker.lon, marker.lat])
                ),
                name: marker.name,
                type: marker.type
            });

            // Style cho marker
            feature.setStyle(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 8,
                    fill: new ol.style.Fill({
                        color: marker.color || 'rgba(255, 0, 0, 0.6)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#fff',
                        width: 2
                    })
                })
            }));

            vectorSource.addFeature(feature);
        });

        const vectorLayer = new ol.layer.Vector({
            source: vectorSource
        });

        this.map.addLayer(vectorLayer);
        Config.log('info', `Added ${markers.length} markers to map`);
    }

    /**
     * Cập nhật status
     */
    updateStatus(text, type = 'info') {
        const statusText = this.container.querySelector('.status-text');
        const statusIndicator = this.container.querySelector('.status-indicator');
        
        if (statusText) {
            statusText.textContent = text;
        }
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${type}`;
        }
    }

    /**
     * Hiển thị loading
     */
    showLoading() {
        const overlay = document.getElementById('map-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    /**
     * Ẩn loading
     */
    hideLoading() {
        const overlay = document.getElementById('map-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Pan to location
     * @param {Array} coordinates - [lon, lat]
     * @param {number} zoom - Zoom level
     */
    panTo(coordinates, zoom = null) {
        if (!this.map) return;

        const view = this.map.getView();
        const center = ol.proj.fromLonLat(coordinates);
        
        view.animate({
            center: center,
            zoom: zoom || view.getZoom(),
            duration: 1000
        });
    }

    /**
     * Adjust map zoom by step
     * @param {number} step
     */
    adjustZoom(step = 1) {
        if (!this.map || typeof step !== 'number') {
            return;
        }

        const view = this.map.getView();
        if (!view) {
            return;
        }

        const viewMinZoom = typeof view.getMinZoom === 'function' ? view.getMinZoom() : undefined;
        const viewMaxZoom = typeof view.getMaxZoom === 'function' ? view.getMaxZoom() : undefined;
        const minZoom =
            typeof Config.MAP.MIN_ZOOM === 'number'
                ? Config.MAP.MIN_ZOOM
                : (typeof viewMinZoom === 'number' ? viewMinZoom : 0);
        const maxZoom =
            typeof Config.MAP.MAX_ZOOM === 'number'
                ? Config.MAP.MAX_ZOOM
                : (typeof viewMaxZoom === 'number' ? viewMaxZoom : 28);

        const currentZoom = typeof view.getZoom === 'function' ? view.getZoom() : Config.MAP.FULLSCREEN_ZOOM;
        const targetZoom = Math.min(maxZoom, Math.max(minZoom, currentZoom + step));

        if (!Number.isFinite(targetZoom) || targetZoom === currentZoom) {
            return;
        }

        const animationDuration = (Config.NAVIGATION && Config.NAVIGATION.ANIMATION_DURATION) || 300;
        view.animate({
            zoom: targetZoom,
            duration: animationDuration
        });
    }

    /**
     * Zoom in helper
     */
    zoomIn() {
        this.adjustZoom(1);
    }

    /**
     * Zoom out helper
     */
    zoomOut() {
        this.adjustZoom(-1);
    }

    /**
     * Get map instance
     */
    getMap() {
        return this.map;
    }

    /**
     * Destroy component
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        if (this.map) {
            this.map.setTarget(null);
            this.map = null;
        }

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.isVisible = false;
        if (typeof window !== 'undefined' && window.mapFullscreen === this) {
            delete window.mapFullscreen;
        }
        Config.log('info', 'MapFullscreen component destroyed');
    }
}

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapFullscreen;
} else {
    window.MapFullscreen = MapFullscreen;
}
