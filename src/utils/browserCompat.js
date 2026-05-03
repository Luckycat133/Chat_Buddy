const checks = {};

export function supports(feature) {
    if (feature in checks) return checks[feature];

    let result = false;
    switch (feature) {
        case 'indexedDB':
            result = typeof indexedDB !== 'undefined';
            break;
        case 'webWorker':
            result = typeof Worker !== 'undefined';
            break;
        case 'sharedWorker':
            result = typeof SharedWorker !== 'undefined';
            break;
        case 'serviceWorker':
            result = 'serviceWorker' in navigator;
            break;
        case 'notification':
            result = typeof Notification !== 'undefined';
            break;
        case 'clipboard':
            result = !!(navigator.clipboard && navigator.clipboard.writeText);
            break;
        case 'requestIdleCallback':
            result = typeof requestIdleCallback === 'function';
            break;
        case 'cssGrid':
            result = CSS.supports?.('display', 'grid') ?? false;
            break;
        case 'cssSubgrid':
            result = CSS.supports?.('grid-template-rows', 'subgrid') ?? false;
            break;
        case 'webAudio':
            result = !!(window.AudioContext || window.webkitAudioContext);
            break;
        case 'resizeObserver':
            result = typeof ResizeObserver !== 'undefined';
            break;
        case 'intersectionObserver':
            result = typeof IntersectionObserver !== 'undefined';
            break;
        default:
            result = false;
    }

    checks[feature] = result;
    return result;
}

export function getUnsupportedFeatures() {
    const required = ['indexedDB', 'webWorker', 'requestIdleCallback', 'cssGrid'];
    return required.filter(f => !supports(f));
}

export function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'unknown';
    let version = 'unknown';

    if (ua.includes('Firefox/')) {
        browser = 'firefox';
        version = ua.match(/Firefox\/([\d.]+)/)?.[1] || 'unknown';
    } else if (ua.includes('Edg/')) {
        browser = 'edge';
        version = ua.match(/Edg\/([\d.]+)/)?.[1] || 'unknown';
    } else if (ua.includes('Chrome/')) {
        browser = 'chrome';
        version = ua.match(/Chrome\/([\d.]+)/)?.[1] || 'unknown';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        browser = 'safari';
        version = ua.match(/Version\/([\d.]+)/)?.[1] || 'unknown';
    }

    return { browser, version, userAgent: ua };
}
