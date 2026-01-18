import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useBackground } from './BackgroundContext';

const BackgroundLayer = ({ chatId, personaId }) => {
    const { getBackgroundForChat } = useBackground();
    const config = getBackgroundForChat(chatId, personaId);

    // If no background type is selected, or type is none, we render nothing (or transparent)
    // But typically we want a base color. For now, let's assume transparent logic or base theme behavior.

    const layerStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0, // Ensure it sits behind content
        overflow: 'hidden',
        pointerEvents: 'none', // Don't block interactions
    };

    const imageStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: `blur(${config.blur}px) opacity(${config.opacity})`,
        transition: 'filter 0.3s ease'
    };

    const overlayStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: config.overlayColor,
        transition: 'background-color 0.3s ease'
    };

    return (
        <div style={layerStyle} className="background-layer">
            <AnimatePresence mode="popLayout">
                {config.type !== 'none' && config.value && (
                    <motion.div
                        key={config.value} // Key by value to trigger animation on change
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                    >
                        {/* We can support different types here, e.g. video later */}
                        <img
                            src={config.value}
                            alt="Chat Background"
                            style={imageStyle}
                            className="transition-all duration-300"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Overlay for contrast */}
            <div style={overlayStyle} />
        </div>
    );
};

export default BackgroundLayer;
