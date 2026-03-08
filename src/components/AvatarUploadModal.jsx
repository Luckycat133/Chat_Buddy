import React, { useState, useRef } from 'react';
import { X, Upload, Check, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

/**
 * Phase 4: Avatar Upload Modal
 * Enhanced avatar upload with canvas cropping and resizing
 * Supports: file selection (jpg/png, max 5MB), canvas cropping, 256x256 output, Base64 storage
 */
export default function AvatarUploadModal({ isOpen, onClose, currentAvatar, onUpload }) {
    const { t } = useLanguage();
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const [step, setStep] = useState('select'); // 'select' | 'crop' | 'preview'
    const [imageUrl, setImageUrl] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Crop state
    const [crop, setCrop] = useState({ x: 0, y: 0, size: 200 });
    const [zoom, setZoom] = useState(1);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const OUTPUT_SIZE = 256; // 256x256 output

    // Generate cropped image
    const generateCroppedImage = React.useCallback(() => {
        if (!canvasRef.current || !imageUrl) return null;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas size to output size
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;

        // Load image and draw cropped region
        const img = new Image();
        img.onload = () => {
            // Calculate source coordinates based on crop and zoom
            const sourceX = crop.x;
            const sourceY = crop.y;
            const sourceSize = crop.size / zoom;

            // Draw image to canvas (cropped and resized to 256x256)
            ctx.drawImage(
                img,
                sourceX, sourceY, sourceSize, sourceSize,
                0, 0, OUTPUT_SIZE, OUTPUT_SIZE
            );
        };
        img.src = imageUrl;

        // Return base64 data URL
        return canvas.toDataURL('image/jpeg', 0.9);
    }, [crop, zoom, imageUrl]);

    if (!isOpen) return null;

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert(t('unsupported_file_type') || 'Please select an image file (JPG, PNG)');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            alert(t('file_too_large') || 'File too large (max 5MB)');
            return;
        }

        setIsProcessing(true);

        // Load image for cropping
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setImageUrl(event.target.result);
                setImageSize({ width: img.width, height: img.height });

                // Initialize crop to center
                const minSize = Math.min(img.width, img.height);
                setCrop({
                    x: (img.width - minSize) / 2,
                    y: (img.height - minSize) / 2,
                    size: minSize
                });
                setZoom(1);

                setStep('crop');
                setIsProcessing(false);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));

    const handleReset = () => {
        if (!imageSize.width || !imageSize.height) return;
        const minSize = Math.min(imageSize.width, imageSize.height);
        setCrop({
            x: (imageSize.width - minSize) / 2,
            y: (imageSize.height - minSize) / 2,
            size: minSize
        });
        setZoom(1);
    };

    const handlePreview = () => {
        const base64 = generateCroppedImage();
        setPreviewUrl(base64 || imageUrl);
        setStep('preview');
    };

    const handleConfirm = () => {
        const base64 = previewUrl || generateCroppedImage();
        if (base64) {
            onUpload(base64);
            onClose();
            // Reset state
            setStep('select');
            setImageUrl(null);
            setPreviewUrl(null);
            setCrop({ x: 0, y: 0, size: 200 });
            setZoom(1);
        }
    };

    const handleCancel = () => {
        onClose();
        // Reset state after close animation
        setTimeout(() => {
            setStep('select');
            setImageUrl(null);
            setPreviewUrl(null);
            setCrop({ x: 0, y: 0, size: 200 });
            setZoom(1);
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[var(--color-bg-white)] rounded-2xl w-[90%] max-w-md max-h-[90vh] overflow-hidden animate-scale-in shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button onClick={handleCancel} className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] transition-colors">
                        <X size={20} className="text-[var(--color-text-muted)]" />
                    </button>
                    <h3 className="font-semibold text-[17px]">
                        {step === 'select' && (t('upload_avatar') || 'Upload Avatar')}
                        {step === 'crop' && (t('crop_avatar') || 'Crop Avatar')}
                        {step === 'preview' && (t('preview_avatar') || 'Preview')}
                    </h3>
                    <div className="w-10" /> {/* Spacer for centering */}
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* Step 1: File Selection */}
                    {step === 'select' && (
                        <div className="space-y-4">
                            <div className="text-center py-8">
                                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[var(--color-bg-active)] flex items-center justify-center">
                                    {currentAvatar ? (
                                        <img
                                            src={currentAvatar}
                                            alt="Current"
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <Upload size={40} className="text-[var(--color-text-muted)]" />
                                    )}
                                </div>
                                <p className="text-[var(--color-text-secondary)] text-sm">
                                    {t('avatar_upload_desc') || 'Upload a photo for your avatar'}
                                </p>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/jpg"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className={cn(
                                    "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all",
                                    "bg-[var(--color-primary)] text-white",
                                    "hover:bg-[var(--color-primary-active)]",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                <Upload size={20} />
                                {isProcessing
                                    ? (t('loading') || 'Processing...')
                                    : (t('select_photo') || 'Select Photo')
                                }
                            </button>

                            <p className="text-xs text-center text-[var(--color-text-muted)]">
                                {t('avatar_upload_hint') || 'JPG or PNG, max 5MB'}
                            </p>
                        </div>
                    )}

                    {/* Step 2: Crop */}
                    {step === 'crop' && imageUrl && (
                        <div className="space-y-4">
                            {/* Crop Preview */}
                            <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-[var(--color-primary)] shadow-lg bg-[var(--color-bg-active)]">
                                <img
                                    src={imageUrl}
                                    alt="Crop preview"
                                    className="absolute max-w-none"
                                    style={{
                                        width: `${imageSize.width * (256 / crop.size) * zoom}px`,
                                        height: `${imageSize.height * (256 / crop.size) * zoom}px`,
                                        left: `${-crop.x * (256 / crop.size) * zoom}px`,
                                        top: `${-crop.y * (256 / crop.size) * zoom}px`,
                                    }}
                                />
                            </div>

                            {/* Zoom Controls */}
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={handleZoomOut}
                                    className="p-2 rounded-full bg-[var(--color-bg-active)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                    <ZoomOut size={20} />
                                </button>
                                <span className="text-sm text-[var(--color-text-muted)] min-w-[60px] text-center">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={handleZoomIn}
                                    className="p-2 rounded-full bg-[var(--color-bg-active)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                    <ZoomIn size={20} />
                                </button>
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 mx-auto text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                            >
                                <RotateCcw size={16} />
                                {t('reset') || 'Reset'}
                            </button>

                            {/* Hidden canvas for processing */}
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setStep('select')}
                                    className="flex-1 py-3 rounded-xl font-medium border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                    {t('back') || 'Back'}
                                </button>
                                <button
                                    onClick={handlePreview}
                                    className="flex-1 py-3 rounded-xl font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-active)] transition-colors"
                                >
                                    {t('preview') || 'Preview'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {step === 'preview' && imageUrl && (
                        <div className="space-y-4">
                            <div className="text-center py-4">
                                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-[var(--color-primary)] shadow-lg">
                                    <img
                                        src={previewUrl || imageUrl}
                                        alt="Avatar preview"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <p className="mt-4 text-[var(--color-text-secondary)] text-sm">
                                    {t('avatar_preview_desc') || 'This is how your avatar will appear'}
                                </p>
                            </div>

                            {/* Hidden canvas for final processing */}
                            <canvas
                                ref={canvasRef}
                                className="hidden"
                                width={OUTPUT_SIZE}
                                height={OUTPUT_SIZE}
                            />

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setStep('crop')}
                                    className="flex-1 py-3 rounded-xl font-medium border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                    {t('back') || 'Back'}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 py-3 rounded-xl font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-active)] transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check size={18} />
                                    {t('confirm') || 'Confirm'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
