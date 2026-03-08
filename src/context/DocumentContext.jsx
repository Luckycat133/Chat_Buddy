import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
    buildRAGContext,
    addDocumentToIndex,
    removeDocumentFromIndex
} from '../utils/ragUtils';
import documentStorage from '../services/storage/DocumentStorageService';

const DocumentContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useDocuments = () => {
    const context = useContext(DocumentContext);
    if (!context) throw new Error('useDocuments must be used within a DocumentProvider');
    return context;
};

export const DocumentProvider = ({ children }) => {
    // Document metadata now primarily stored in IndexedDB (with legacy migration).
    const [documents, setDocuments] = useState([]);

    // RAG enabled state
    const [ragEnabled, setRagEnabled] = useLocalStorage('chat-buddy-rag-enabled', true);

    // Indexed chunks now primarily stored in IndexedDB.
    const [indexedChunks, setIndexedChunks] = useState([]);

    useEffect(() => {
        let disposed = false;

        async function hydrate() {
            await documentStorage.migrateFromLocalStorage();
            const [storedDocs, storedIndex] = await Promise.all([
                documentStorage.loadDocuments(),
                documentStorage.loadIndex()
            ]);
            if (disposed) return;
            setDocuments(Array.isArray(storedDocs) ? storedDocs : []);
            setIndexedChunks(Array.isArray(storedIndex) ? storedIndex : []);
        }

        hydrate();
        return () => { disposed = true; };
    }, []);

    // Add a new document
    const addDocument = useCallback((fileData) => {
        const newDoc = {
            id: crypto.randomUUID(),
            name: fileData.name,
            size: fileData.size,
            type: fileData.type,
            icon: fileData.icon,
            content: fileData.content,
            addedAt: new Date().toISOString()
        };

        // Add to documents list
        setDocuments(prev => {
            const next = [newDoc, ...prev];
            documentStorage.saveDocuments(next);
            return next;
        });

        // Index for RAG
        setIndexedChunks(prev => {
            const updatedIndex = addDocumentToIndex(newDoc, prev, { persist: false });
            documentStorage.saveIndex(updatedIndex);
            return updatedIndex;
        });

        return newDoc;
    }, []);

    // Remove a document
    const removeDocument = useCallback((documentId) => {
        setDocuments(prev => {
            const next = prev.filter(d => d.id !== documentId);
            documentStorage.saveDocuments(next);
            return next;
        });

        // Remove from index
        setIndexedChunks(prev => {
            const updatedIndex = removeDocumentFromIndex(documentId, prev, { persist: false });
            documentStorage.saveIndex(updatedIndex);
            return updatedIndex;
        });
    }, []);

    // Search documents for RAG context
    const searchForContext = useCallback((query) => {
        if (!ragEnabled || indexedChunks.length === 0) {
            return null;
        }
        return buildRAGContext(query, indexedChunks);
    }, [ragEnabled, indexedChunks]);

    // Get document by ID
    const getDocument = useCallback((documentId) => {
        return documents.find(d => d.id === documentId);
    }, [documents]);

    // Toggle RAG
    const toggleRAG = useCallback(() => {
        setRagEnabled(prev => !prev);
    }, [setRagEnabled]);

    const value = {
        documents,
        ragEnabled,
        indexedChunks,
        addDocument,
        removeDocument,
        searchForContext,
        getDocument,
        toggleRAG,
        setRagEnabled
    };

    return (
        <DocumentContext.Provider value={value}>
            {children}
        </DocumentContext.Provider>
    );
};
