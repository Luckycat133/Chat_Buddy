import React from 'react';

/**
 * DynamicBackground — renders animated CSS backgrounds.
 * Supports: particles, aurora, rain, gradient
 *
 * Particle / rain positions are pre-computed at module level to avoid
 * calling Math.random() during render (react-hooks/purity rule).
 */

// ── Pre-computed static data ──────────────────────────────────
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${(i * 5.3 + 7) % 100}%`,
    top: `${(i * 7.1 + 11) % 100}%`,
    size: `${4 + (i % 9)}px`,
    delay: `${(i * 0.4) % 6}s`,
    duration: `${5 + (i % 8)}s`,
}));

const RAIN_DROPS = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${(i * 2.1 + 3) % 100}%`,
    delay: `${(i * 0.07) % 3}s`,
    duration: `${0.5 + (i % 8) * 0.1}s`,
    height: `${60 + (i % 60)}px`,
    opacity: 0.3 + (i % 5) * 0.1,
}));

// ── Main component ────────────────────────────────────────────
const DynamicBackground = ({ config }) => {
    const { animationType = 'particles', colors = ['#1a1a2e', '#16213e'] } = config;

    const baseStyle = {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
    };

    if (animationType === 'particles') {
        return <ParticlesBackground colors={colors} baseStyle={baseStyle} />;
    }
    if (animationType === 'aurora') {
        return <AuroraBackground colors={colors} baseStyle={baseStyle} />;
    }
    if (animationType === 'rain') {
        return <RainBackground colors={colors} baseStyle={baseStyle} />;
    }
    if (animationType === 'gradient') {
        return <GradientBackground colors={colors} baseStyle={baseStyle} />;
    }
    return null;
};

/* ── Particles ─────────────────────────────────────────────── */
const ParticlesBackground = ({ colors, baseStyle }) => {
    const bgColor = colors[0] || '#1a1a2e';
    const particleColor = colors[1] || '#ffffff';

    return (
        <div style={{ ...baseStyle, background: bgColor }}>
            {PARTICLES.map((p) => (
                <div
                    key={p.id}
                    style={{
                        position: 'absolute',
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        background: particleColor,
                        opacity: 0.6,
                        animation: `floatSoft ${p.duration} ease-in-out ${p.delay} infinite`,
                    }}
                />
            ))}
        </div>
    );
};

/* ── Aurora ─────────────────────────────────────────────────── */
const AuroraBackground = ({ colors, baseStyle }) => {
    const [c0 = '#0d1117', c1 = '#1a472a', c2 = '#0ea5e9'] = colors;
    return (
        <div
            style={{
                ...baseStyle,
                background: `linear-gradient(135deg, ${c0}, ${c1}, ${c2}, ${c0})`,
                backgroundSize: '300% 300%',
                animation: 'aurora-shift 12s ease infinite',
            }}
        />
    );
};

/* ── Rain ───────────────────────────────────────────────────── */
const RainBackground = ({ colors, baseStyle }) => {
    const bgColor = colors[0] || '#1a1a2e';

    return (
        <div style={{ ...baseStyle, background: bgColor }}>
            {RAIN_DROPS.map((d) => (
                <div
                    key={d.id}
                    style={{
                        position: 'absolute',
                        left: d.left,
                        top: '-100px',
                        width: '1.5px',
                        height: d.height,
                        background: 'rgba(173,216,230,0.7)',
                        opacity: d.opacity,
                        animation: `rainFall ${d.duration} linear ${d.delay} infinite`,
                    }}
                />
            ))}
        </div>
    );
};

/* ── Gradient Flow ──────────────────────────────────────────── */
const GradientBackground = ({ colors, baseStyle }) => {
    const [c0 = '#667eea', c1 = '#764ba2'] = colors;
    return (
        <div
            style={{
                ...baseStyle,
                background: `linear-gradient(270deg, ${c0}, ${c1}, ${c0})`,
                backgroundSize: '400% 400%',
                animation: 'gradientFlow 8s ease infinite',
            }}
        />
    );
};

export default DynamicBackground;
