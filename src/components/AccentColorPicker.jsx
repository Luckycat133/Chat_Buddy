import React, { useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { RotateCcw, Pipette } from 'lucide-react';
import { cn } from '../utils/cn';

const PRESETS = [
    { id: 'default', hex: '#ff9b7a', labelKey: 'accent_default' },
    { id: 'coral', hex: '#ff7e9d', labelKey: 'accent_coral' },
    { id: 'lavender', hex: '#b8a4e3', labelKey: 'accent_lavender' },
    { id: 'mint', hex: '#7ddfc3', labelKey: 'accent_mint' },
    { id: 'sky', hex: '#7dc4ff', labelKey: 'accent_sky' },
    { id: 'gold', hex: '#ffd666', labelKey: 'accent_gold' },
    { id: 'rose', hex: '#f472b6', labelKey: 'accent_rose' },
    { id: 'indigo', hex: '#818cf8', labelKey: 'accent_indigo' },
];

export default function AccentColorPicker() {
    const { theme, setAccentColor, resetAccentColor } = useTheme();
    const { t } = useLanguage();
    const colorInputRef = useRef(null);

    const currentColor = theme.accentColor || PRESETS[0].hex;
    const isDefault = !theme.accentColor;

    const handlePreset = (preset) => {
        if (preset.id === 'default') {
            resetAccentColor();
        } else {
            setAccentColor(preset.hex);
        }
    };

    const handleCustom = (e) => {
        setAccentColor(e.target.value);
    };

    const isSelected = (preset) => {
        if (preset.id === 'default' && isDefault) return true;
        if (preset.id !== 'default' && !isDefault && theme.accentColor?.toLowerCase() === preset.hex.toLowerCase()) return true;
        return false;
    };

    const isCustomColor = !isDefault && !PRESETS.some(p => p.hex.toLowerCase() === currentColor.toLowerCase());

    return (
        <div className="glass-crystal rounded-[var(--radius-xl)] p-5 shadow-floating">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-main)]">
                        {t('accent_color')}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {t('accent_color_desc')}
                    </p>
                </div>
                {!isDefault && (
                    <button
                        onClick={resetAccentColor}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]
                            hover:bg-[var(--color-bg-hover)] transition-all duration-200"
                        title={t('accent_reset')}
                    >
                        <RotateCcw size={14} />
                        {t('accent_reset')}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                {PRESETS.map((preset) => (
                    <button
                        key={preset.id}
                        onClick={() => handlePreset(preset)}
                        className={cn(
                            "w-9 h-9 rounded-full transition-all duration-300 relative",
                            "hover:scale-110 active:scale-95",
                            isSelected(preset) && "ring-2 ring-offset-2 ring-offset-[var(--color-bg-card)] ring-[var(--color-text-main)] scale-110"
                        )}
                        style={{ backgroundColor: preset.hex }}
                        title={t(preset.labelKey)}
                        aria-label={t(preset.labelKey)}
                    />
                ))}

                {/* Custom color picker */}
                <button
                    onClick={() => colorInputRef.current?.click()}
                    className={cn(
                        "w-9 h-9 rounded-full transition-all duration-300 relative",
                        "border-2 border-dashed border-[var(--color-border)]",
                        "hover:scale-110 active:scale-95 flex items-center justify-center",
                        "hover:border-[var(--color-primary)]",
                        isCustomColor && "ring-2 ring-offset-2 ring-offset-[var(--color-bg-card)] ring-[var(--color-text-main)] scale-110"
                    )}
                    style={isCustomColor ? { backgroundColor: currentColor, borderStyle: 'solid', borderColor: currentColor } : {}}
                    title={t('accent_custom')}
                    aria-label={t('accent_custom')}
                >
                    {!isCustomColor && <Pipette size={14} className="text-[var(--color-text-muted)]" />}
                </button>
                <input
                    ref={colorInputRef}
                    type="color"
                    value={currentColor}
                    onChange={handleCustom}
                    className="sr-only"
                    aria-label={t('accent_custom')}
                />
            </div>
        </div>
    );
}
