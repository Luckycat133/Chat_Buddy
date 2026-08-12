/**
 * Compute a full accent palette from a single hex color.
 * Returns CSS-ready values for all primary color variables.
 */

function hexToHSL(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
    };
}

function toLinearChannel(value) {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return 0.2126 * toLinearChannel(r) + 0.7152 * toLinearChannel(g) + 0.0722 * toLinearChannel(b);
}

function contrastRatio(first, second) {
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
}

export function getAccessibleTextColor(background) {
    const luminance = relativeLuminance(background);
    const blackContrast = contrastRatio(luminance, 0);
    const whiteContrast = contrastRatio(luminance, 1);
    return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}

/**
 * Given a hex color, compute 6 derived CSS values:
 * primary, hover, active, light, softer, glow
 */
export function computeAccentPalette(hexColor) {
    const { h, s, l } = hexToHSL(hexColor);
    const { r, g, b } = hexToRgb(hexColor);

    return {
        primary: hexColor,
        hover: hslToHex(h, Math.min(s + 5, 100), Math.max(l - 8, 0)),
        active: hslToHex(h, Math.min(s + 5, 100), Math.max(l - 15, 0)),
        light: hslToHex(h, Math.min(s, 100), Math.min(l + 25, 95)),
        softer: hslToHex(h, Math.max(s - 15, 0), Math.min(l + 35, 97)),
        glow: `rgba(${r}, ${g}, ${b}, 0.35)`,
        onPrimary: getAccessibleTextColor(hexColor),
    };
}
