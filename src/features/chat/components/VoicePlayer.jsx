import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * Voice Player Component - T07: Voice Message Waveform
 * Displays voice messages with waveform visualization and playback controls
 */
export default function VoicePlayer({ duration, url, waveform, isMe }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef(null);
    const progressInterval = useRef(null);

    // Parse duration (format: "30s" or numeric)
    const durationSeconds = typeof duration === 'string'
        ? parseInt(duration.replace(/[^0-9]/g, '')) || 0
        : duration || 0;

    // Generate mock waveform if not provided (16 bars)
    const waveformData = waveform?.length > 0
        ? waveform
        : generateMockWaveform(durationSeconds);

    useEffect(() => {
        // Copy ref values to variables in effect body
        const audioElement = audioRef.current;
        const progressIntervalRef = progressInterval.current;
        return () => {
            if (progressIntervalRef) {
                clearInterval(progressIntervalRef);
            }
            if (audioElement) {
                audioElement.pause();
            }
        };
    }, []);

    const generateMockWaveform = (duration) => {
        // Generate random waveform bars based on duration
        const bars = Math.min(Math.max(duration, 8), 20);
        return Array.from({ length: bars }, () =>
            Math.floor(Math.random() * 60) + 20
        );
    };

    const togglePlay = () => {
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    };

    const playAudio = () => {
        setIsPlaying(true);
        // Simulate audio progress if no real URL
        if (!url || url === '#') {
            progressInterval.current = setInterval(() => {
                setCurrentTime(prev => {
                    const next = prev + 0.1;
                    if (next >= durationSeconds) {
                        pauseAudio();
                        return 0;
                    }
                    setProgress((next / durationSeconds) * 100);
                    return next;
                });
            }, 100);
        } else if (audioRef.current) {
            audioRef.current.play();
            progressInterval.current = setInterval(() => {
                if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime);
                    setProgress((audioRef.current.currentTime / durationSeconds) * 100);
                }
            }, 100);
        }
    };

    const pauseAudio = () => {
        setIsPlaying(false);
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
        }
        if (audioRef.current) {
            audioRef.current.pause();
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate which bars should be highlighted based on progress
    const highlightedBars = Math.floor((progress / 100) * waveformData.length);

    return (
        <div
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-2xl min-w-[220px] max-w-[320px]",
                isMe
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-bg-active)] text-[var(--color-text-main)]"
            )}
        >
            {/* Hidden audio element for real playback */}
            {url && url !== '#' && (
                <audio
                    ref={audioRef}
                    src={url}
                    onEnded={() => {
                        setIsPlaying(false);
                        setCurrentTime(0);
                        setProgress(0);
                    }}
                />
            )}

            {/* Play/Pause Button */}
            <button
                onClick={togglePlay}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95",
                    isMe
                        ? "bg-white text-[var(--color-primary)] hover:bg-white/90"
                        : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-active)]"
                )}
            >
                {isPlaying ? (
                    <Pause size={18} fill="currentColor" />
                ) : (
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
            </button>

            {/* Waveform Visualization */}
            <div className="flex-1 flex items-center gap-0.5 h-8">
                {waveformData.map((height, index) => (
                    <div
                        key={index}
                        className={cn(
                            "flex-1 rounded-full transition-all duration-200",
                            isMe
                                ? (index < highlightedBars && isPlaying)
                                    ? "bg-white"
                                    : "bg-white/40"
                                : (index < highlightedBars && isPlaying)
                                    ? "bg-[var(--color-primary)]"
                                    : "bg-[var(--color-text-muted)]/30"
                        )}
                        style={{
                            height: `${height}%`,
                            minHeight: '4px'
                        }}
                    />
                ))}
            </div>

            {/* Duration / Time Display */}
            <div className="flex items-center gap-1 text-xs font-medium min-w-[40px]">
                <Volume2 size={12} className={isMe ? "text-white/70" : "text-[var(--color-text-muted)]"} />
                <span className={isMe ? "text-white/90" : "text-[var(--color-text-muted)]"}>
                    {formatTime(isPlaying ? currentTime : durationSeconds)}
                </span>
            </div>
        </div>
    );
}

/**
 * Voice Recording Component - Used in ChatComposer
 * Shows recording progress with waveform animation
 */
export function VoiceRecorder({ isRecording, duration }) {
    if (!isRecording) return null;

    // Predefined heights for waveform bars (to avoid Math.random in render)
    const barHeights = [45, 65, 35, 80, 55, 70, 40, 60];

    // Animated waveform bars during recording
    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">{duration}s</span>
            <div className="flex items-center gap-0.5 h-4">
                {barHeights.map((height, i) => (
                    <div
                        key={i}
                        className="w-1 bg-red-400 rounded-full animate-pulse"
                        style={{
                            height: `${height}%`,
                            animationDelay: `${i * 0.1}s`
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
