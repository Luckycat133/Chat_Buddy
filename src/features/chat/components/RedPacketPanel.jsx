import React, { useState } from 'react';
import { X, Gift, Sparkles } from 'lucide-react';
import { useSocial } from '../../../context/SocialContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { cn } from '../../../utils/cn';

// Red packet amounts
const AMOUNTS = [10, 20, 50, 100, 200, 520];

export default function RedPacketPanel({ recipientName, onClose, onSend }) {
    const { points } = useSocial();
    const { t } = useLanguage();
    const trapRef = useFocusTrap(true, onClose);
    const [amount, setAmount] = useState(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const canAfford = amount && points >= amount;

    const handleSend = () => {
        if (!canAfford) return;
        setSending(true);

        setTimeout(() => {
            setSending(false);
            onSend?.({ amount, message });
            onClose?.();
        }, 800);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="presentation" onClick={onClose}>
            <div
                ref={trapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="red-packet-title"
                className="w-full max-w-xs overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Red Packet Design */}
                <div className="bg-gradient-to-b from-red-500 to-red-600 rounded-xl overflow-hidden shadow-2xl">
                    {/* Top Section */}
                    <div className="relative p-6 text-center text-yellow-100">
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 text-white/60 hover:text-white"
                            aria-label="Close"
                        >
                            <X size={24} />
                        </button>

                        <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                            <Gift size={32} className="text-yellow-400" />
                        </div>

                        <h3 id="red-packet-title" className="text-xl font-bold text-yellow-400">
                            {t('send_red_packet')}
                        </h3>
                        <p className="text-sm mt-1 text-yellow-200/80">
                            {recipientName
                                ? t('send_to', { name: recipientName })
                                : t('select_amount')
                            }
                        </p>
                    </div>

                    {/* Amount Grid */}
                    <div className="bg-white/10 p-4">
                        <div className="grid grid-cols-3 gap-2">
                            {AMOUNTS.map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setAmount(amt)}
                                    disabled={points < amt}
                                    className={cn(
                                        "py-3 rounded-lg text-center font-medium transition-all",
                                        amount === amt
                                            ? "bg-yellow-400 text-red-700"
                                            : points >= amt
                                                ? "bg-white/20 text-white hover:bg-white/30"
                                                : "bg-white/5 text-white/30 cursor-not-allowed"
                                    )}
                                >
                                    💰 {amt}
                                </button>
                            ))}
                        </div>

                        <p className="text-center text-yellow-200/60 text-xs mt-3">
                            {t('current_points')}: {points}
                        </p>
                    </div>

                    {/* Message Input */}
                    <div className="p-4 bg-white/10">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('red_packet_wish_placeholder')}
                            maxLength={30}
                            className="w-full px-4 py-2 bg-white/20 rounded-lg text-white placeholder:text-white/40 text-center outline-none"
                        />
                    </div>

                    {/* Bottom Gold Bar */}
                    <div className="h-8 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles size={16} className="text-yellow-700" />
                        </div>
                    </div>

                    {/* Send Button */}
                    <div className="p-4 bg-red-700">
                        <button
                            onClick={handleSend}
                            disabled={!canAfford || sending}
                            className={cn(
                                "w-full py-3 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2",
                                canAfford && !sending
                                    ? "bg-yellow-400 text-red-700 hover:bg-yellow-300"
                                    : "bg-gray-400/50 text-white/50 cursor-not-allowed"
                            )}
                        >
                            {sending ? (
                                <div className="w-6 h-6 border-2 border-red-700/30 border-t-red-700 rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Gift size={20} />
                                    {amount
                                        ? t('send_x_points', { amount })
                                        : t('select_amount')
                                    }
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
