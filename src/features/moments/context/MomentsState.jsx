import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { cloudEnabled, loadTokens } from '../../../api/cloud-adapter';
import {
    fetchCloudActorNames,
    fetchCloudMomentFeed,
    mapCloudFeedItem,
} from '../services/momentsCloudService';

const MomentsStateContext = createContext();

const DEFAULT_MOMENTS_DATA = {
    posts: [],
    lastAIPostTime: {},
    imageApiUrl: '',
    draft: null,
    lastStoryEventDate: null,
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMomentsState = () => {
    const context = useContext(MomentsStateContext);
    if (!context) throw new Error('useMomentsState must be used within a MomentsProvider');
    return context;
};

export const MomentsStateProvider = ({ children }) => {
    const [momentsData, setMomentsData] = useLocalStorage('chat-buddy-moments', DEFAULT_MOMENTS_DATA);
    const [imageApiKey, setImageApiKey] = useState('');
    const cloudMode = cloudEnabled();
    const [actorNames, setActorNames] = useState({});
    const [cloudFeedCursor, setCloudFeedCursor] = useState(null);
    const [cloudFeedLoading, setCloudFeedLoading] = useState(cloudMode);
    const [cloudFeedError, setCloudFeedError] = useState(null);

    useEffect(() => {
        if (!Object.hasOwn(momentsData, 'imageApiKey')) return;
        setMomentsData(({ imageApiKey: _legacyKey, ...rest }) => rest);
    }, [momentsData, setMomentsData]);

    useEffect(() => {
        if (!cloudMode) return undefined;

        let cancelled = false;
        setCloudFeedLoading(true);
        setCloudFeedError(null);
        setMomentsData(prev => ({ ...prev, posts: [] }));

        Promise.all([
            fetchCloudActorNames(),
            fetchCloudMomentFeed({ limit: 20 }),
        ]).then(([actorNameMap, feed]) => {
            if (cancelled) return;

            const nextActorNames = Object.fromEntries(actorNameMap.entries());
            const viewerActorId = loadTokens().actorId;
            const cloudPosts = (feed.items || [])
                .map(item => mapCloudFeedItem(item, viewerActorId, actorNameMap))
                .filter(Boolean)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setActorNames(nextActorNames);
            setMomentsData(prev => ({ ...prev, posts: cloudPosts }));
            setCloudFeedCursor(feed.nextCursor || null);
        }).catch(error => {
            if (cancelled) return;
            setCloudFeedCursor(null);
            setCloudFeedError(error?.message || 'Failed to load cloud moments');
        }).finally(() => {
            if (!cancelled) setCloudFeedLoading(false);
        });

        return () => {
            cancelled = true;
        };
    // setMomentsData is recreated by useLocalStorage; cloudMode is the stable trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cloudMode]);

    const loadMoreMoments = useCallback(async () => {
        if (!cloudMode || !cloudFeedCursor || cloudFeedLoading) return;

        setCloudFeedLoading(true);
        setCloudFeedError(null);
        try {
            const actorNameMap = new Map(Object.entries(actorNames));
            const viewerActorId = loadTokens().actorId;
            const feed = await fetchCloudMomentFeed({ cursor: cloudFeedCursor, limit: 20 });
            const nextPosts = (feed.items || [])
                .map(item => mapCloudFeedItem(item, viewerActorId, actorNameMap))
                .filter(Boolean);

            setMomentsData(prev => {
                const existingIds = new Set((prev.posts || []).map(post => post.id));
                const uniqueNextPosts = nextPosts.filter(post => !existingIds.has(post.id));
                return {
                    ...prev,
                    posts: [...(prev.posts || []), ...uniqueNextPosts]
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
                };
            });
            setCloudFeedCursor(feed.nextCursor || null);
        } catch (error) {
            setCloudFeedError(error?.message || 'Failed to load more cloud moments');
        } finally {
            setCloudFeedLoading(false);
        }
    }, [actorNames, cloudFeedCursor, cloudFeedLoading, cloudMode, setMomentsData]);

    // Refs for intervals (moved here or staying in provider? If logic is extracted, refs might be needed in the logic hook)
    // Actually, the main provider (Facade) will hold the AI logic which uses these refs.
    // But the refs themselves are not really "State" that consumers need.
    // Consumers just need `posts` etc.

    // We will expose setters here so ActionProvider can use them.

    const value = {
        momentsData,
        setMomentsData,
        posts: momentsData.posts || [],
        lastAIPostTime: momentsData.lastAIPostTime || {},
        imageApiKey,
        setImageApiKey,
        imageApiUrl: momentsData.imageApiUrl,
        draft: momentsData.draft || null,
        lastStoryEventDate: momentsData.lastStoryEventDate || null,
        cloudMode,
        actorNames,
        setActorNames,
        cloudFeedCursor,
        setCloudFeedCursor,
        cloudFeedLoading,
        setCloudFeedLoading,
        cloudFeedError,
        setCloudFeedError,
        loadMoreMoments,
    };

    return (
        <MomentsStateContext.Provider value={value}>
            {children}
        </MomentsStateContext.Provider>
    );
};
