import { useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const TOTAL_STEPS = 5;

export function useOnboarding() {
    const [done, setDone] = useLocalStorage('chat-buddy-onboarding-done', false);
    const [currentStep, setCurrentStep] = useState(0);

    const shouldShow = !done;

    const nextStep = useCallback(() => {
        setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1));
    }, []);

    const prevStep = useCallback(() => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    }, []);

    const skip = useCallback(() => {
        setDone(true);
        setCurrentStep(0);
    }, [setDone]);

    const complete = useCallback(() => {
        setDone(true);
        setCurrentStep(0);
    }, [setDone]);

    const reset = useCallback(() => {
        setDone(false);
        setCurrentStep(0);
    }, [setDone]);

    return {
        shouldShow,
        currentStep,
        totalSteps: TOTAL_STEPS,
        nextStep,
        prevStep,
        skip,
        complete,
        reset,
    };
}
