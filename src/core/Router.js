/**
 * Router.js - Simple router cho Single Page Application
 */

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.history = [];
        this.beforeRouteChange = null;
        this.afterRouteChange = null;
    }

    /**
     * Đăng ký một route
     * @param {string} path - Route path
     * @param {Function} handler - Route handler
     */
    register(path, handler) {
        this.routes.set(path, handler);
    }

    /**
     * Navigate to route
     * @param {string} path - Route path
     * @param {Object} params - Route parameters
     */
    navigate(path, params = {}) {
        // Call before hook
        if (this.beforeRouteChange) {
            const canNavigate = this.beforeRouteChange(this.currentRoute, path, params);
            if (!canNavigate) {
                return false;
            }
        }

        // Get route handler
        const handler = this.routes.get(path);
        if (!handler) {
            return false;
        }

        // Add to history
        if (this.currentRoute) {
            this.history.push(this.currentRoute);
            if (this.history.length > 20) {
                this.history.shift();
            }
        }

        // Update current route
        const previousRoute = this.currentRoute;
        this.currentRoute = {
            path,
            params,
            timestamp: Date.now()
        };


        // Execute handler
        try {
            handler(params);
            
            // Call after hook
            if (this.afterRouteChange) {
                this.afterRouteChange(previousRoute, this.currentRoute);
            }

            // Dispatch navigation event
            window.dispatchEvent(new CustomEvent('routeChanged', {
                detail: {
                    from: previousRoute,
                    to: this.currentRoute
                }
            }));

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Go back to previous route
     */
    back() {
        if (this.history.length === 0) {
            return false;
        }

        const previousRoute = this.history.pop();
        return this.navigate(previousRoute.path, previousRoute.params);
    }

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Get history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Set before route change hook
     * @param {Function} hook - Hook function(from, to, params) => boolean
     */
    setBeforeRouteChange(hook) {
        this.beforeRouteChange = hook;
    }

    /**
     * Set after route change hook
     * @param {Function} hook - Hook function(from, to)
     */
    setAfterRouteChange(hook) {
        this.afterRouteChange = hook;
    }

    /**
     * Clear all routes
     */
    clear() {
        this.routes.clear();
        this.currentRoute = null;
        this.history = [];
    }
}

// Export cho các module khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
} else {
    window.Router = Router;
}
