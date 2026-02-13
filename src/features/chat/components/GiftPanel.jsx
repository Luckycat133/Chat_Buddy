import React, { useState, useCallback } from 'react';
import { X, Gift, Heart, Star, Diamond, Crown, Flower2 } from 'lucide-react';
import { useSocial } from '../../../context/SocialContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

export default function GiftPanel({ recipientId, recipientName, onClose, onGiftSent }) {
    const { gifts, sendGift, points, getIntimacy, getIntimacyLevel } = useSocial();
    const { t, language } = useLanguage();
    const [selectedGift, setSelectedGift] = useState(null);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    const intimacy = getIntimacy(recipientId);
    const intimacyLevel = getIntimacyLevel(recipientId);

    const handleSend = useCallback(async () => {
        if (!selectedGift) return;
        setSending(true);

        const sendResult = sendGift(recipientId, selectedGift.id);

        setTimeout(() => {
            setSending(false);
            setResult(sendResult);

            if (sendResult.success) {
                onGiftSent?.(selectedGift, sendResult.newIntimacy);
                setTimeout(() => {
                    setSelectedGift(null);
                    setResult(null);
                }, 1500);
            }
        }, 800);
    }, [selectedGift, recipientId, sendGift, onGiftSent]);

    const getGiftIcon = (giftId) => {
        const icons = {
            flower: Flower2,
            cake: Gift,
            heart: Heart,
            star: Star,
            diamond: Diamond,
            crown: Crown
        };
        return icons[giftId] || Gift;
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
            <div
                className="bg-[var(--color-bg-white)] rounded-t-2xl w-full max-w-lg animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <div>
                        <h3 className="font-medium text-[17px]">
                            {t('send_gift_to', { name: recipientName })}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {t('points')}: {points}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-muted)]">
                        <X size={24} />
                    </button>
                </div>

                {/* Intimacy Bar */}
                <div className="px-4 py-3 bg-[var(--color-bg-app)]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: intimacyLevel.color }}>
                            {language === 'zh' ? intimacyLevel.name : intimacyLevel.name_en}
                        </span>
                        <span className="text-sm text-[var(--color-text-muted)]">
                            {intimacy}/100
                        </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-500"
                            style={{
                                width: `${intimacy}%`,
                                backgroundColor: intimacyLevel.color
                            }}
                        />
                    </div>
                </div>

                {/* Gift Grid */}
                <div className="p-4 grid grid-cols-3 gap-3">
                    {gifts.map(gift => {
                        const Icon = getGiftIcon(gift.id);
                        const canAfford = points >= gift.cost;
                        const isSelected = selectedGift?.id === gift.id;

                        return (
                            <button
                                key={gift.id}
                                onClick={() => canAfford && setSelectedGift(gift)}
                                disabled={!canAfford}
                                className={cn(
                                    "p-4 rounded-xl border-2 transition-all",
                                    isSelected
                                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                        : canAfford
                                            ? "border-transparent bg-[var(--color-bg-app)] hover:border-[var(--color-primary)]/50"
                                            : "border-transparent bg-gray-100 opacity-50 cursor-not-allowed"
                                )}
                            >
                                <div className="text-3xl text-center mb-2">{gift.emoji}</div>
                                <p className="text-sm font-medium text-center">
                                    {language === 'zh' ? gift.name : gift.name_en}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)] text-center mt-1">
                                    💎 {gift.cost} | +{gift.intimacyBoost}❤️
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Result Message */}
                {result && (
                    <div className={cn(
                        "px-4 py-2 text-center text-sm font-medium",
                        result.success ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                    )}>
                        {result.success
                            ? `🎉 ${t('gift_sent_success')}`
                            : `❌ ${t('insufficient_points')}`
                        }
                    </div>
                )}

                {/* Send Button */}
                <div className="p-4 border-t border-[var(--color-border)]">
                    <button
                        onClick={handleSend}
                        disabled={!selectedGift || sending}
                        className={cn(
                            "w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                            selectedGift && !sending
                                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                    >
                        {sending ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('sending_ellipsis')}
                            </>
                        ) : (
                            <>
                                <Gift size={20} />
                                {selectedGift
                                    ? t('send_gift_cost', { emoji: selectedGift.emoji, cost: selectedGift.cost })
                                    : t('select_gift')
                                }
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
