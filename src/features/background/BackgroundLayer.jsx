import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackground } from './BackgroundContext';
import DynamicBackground from './components/DynamicBackground';

// Extract motion.div so ESLint recognises the import as used
const MotionDiv = motion.div;

const BackgroundLayer = ({ chatId, personaId }) => {
    const { getBackgroundForChat, imageUrls } = useBackground();
    const config = getBackgroundForChat(chatId, personaId);

    const layerStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
    };

    const overlayStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: config.overlayColor || 'rgba(0,0,0,0)',
        transition: 'background-color 0.3s ease',
        zIndex: 2,
    };

    // Resolve custom image URL from imageUrls map
    const resolveValue = () => {
        if (config.type === 'custom' && config.value) {
            return imageUrls[config.value] || config.value;
        }
        return config.value;
    };

    const resolvedValue = resolveValue();

    const filterStr = `blur(${config.blur || 0}px) opacity(${config.opacity !== undefined ? config.opacity : 1})`;

    return (
        <div style={layerStyle} className="background-layer">
            <AnimatePresence mode="popLayout">
                {config.type !== 'none' && resolvedValue && (
                    <MotionDiv
                        key={`${config.type}-${resolvedValue}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }}
                    >
                        {/* Video background */}
                        {config.type === 'video' && (
                            <VideoLayer value={resolvedValue} filterStr={filterStr} />
                        )}

                        {/* Animated / dynamic background */}
                        {config.type === 'animated' && (
                            <div style={{ position: 'absolute', inset: 0, filter: filterStr }}>
                                <DynamicBackground config={config} />
                            </div>
                        )}

                        {/* Image backgrounds (preset, custom) */}
                        {(config.type === 'preset' || config.type === 'custom') && (
                            <ParallaxImageLayer
                                src={resolvedValue}
                                filterStr={filterStr}
                                parallax={config.parallax || 0}
                            />
                        )}
                    </MotionDiv>
                )}

                {/* Animated type with no value still renders */}
                {config.type === 'animated' && !resolvedValue && (
                    <MotionDiv
                        key={`animated-${config.animationType}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }}
                    >
                        <DynamicBackground config={config} />
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* Overlay for contrast */}
            <div style={overlayStyle} />
        </div>
    );
};

/* ── Video Layer ──────────────────────────────────────────── */
const VideoLayer = ({ value, filterStr }) => (
    <video
        src={value}
        autoPlay
        muted
        loop
        playsInline
        style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: filterStr,
        }}
    />
);

/* ── Parallax Image Layer ─────────────────────────────────── */
const ParallaxImageLayer = ({ src, filterStr, parallax }) => {
    const containerRef = useRef(null);
    const imgRef = useRef(null);

    useEffect(() => {
        if (!parallax || parallax <= 0) return;

        const intensity = parallax / 2000; // Normalize 0-100 to subtle range

        const handleMouseMove = (e) => {
            if (!imgRef.current) return;
            const { innerWidth, innerHeight } = window;
            const x = (e.clientX - innerWidth / 2) * intensity;
            const y = (e.clientY - innerHeight / 2) * intensity;
            imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [parallax]);

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <img
                ref={imgRef}
                src={src}
                alt="Chat Background"
                style={{
                    width: '110%',
                    height: '110%',
                    objectFit: 'cover',
                    filter: filterStr,
                    transition: 'transform 0.1s ease-out, filter 0.3s ease',
                    marginLeft: '-5%',
                    marginTop: '-5%',
                }}
                className="transition-all duration-300"
            />
        </div>
    );
};

export default BackgroundLayer;
