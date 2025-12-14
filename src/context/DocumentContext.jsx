import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
    loadIndex,
    saveIndex,
    indexDocument,
    searchDocuments,
    buildRAGContext,
    addDocumentToIndex,
    removeDocumentFromIndex
} from '../utils/ragUtils';

const DocumentContext = createContext();

export const useDocuments = () => {
    const context = useContext(DocumentContext);
    if (!context) throw new Error('useDocuments must be used within a DocumentProvider');
    return context;
};

export const DocumentProvider = ({ children }) => {
    // Document metadata storage
    const [documents, setDocuments] = useLocalStorage('chat-buddy-documents', []);

    // RAG enabled state
    const [ragEnabled, setRagEnabled] = useLocalStorage('chat-buddy-rag-enabled', true);

    // Indexed chunks (loaded from localStorage)
    const [indexedChunks, setIndexedChunks] = useState(() => loadIndex());

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
        setDocuments(prev => [newDoc, ...prev]);

        // Index for RAG
        const updatedIndex = addDocumentToIndex(newDoc);
        setIndexedChunks(updatedIndex);

        return newDoc;
    }, [setDocuments]);

    // Remove a document
    const removeDocument = useCallback((documentId) => {
        setDocuments(prev => prev.filter(d => d.id !== documentId));

        // Remove from index
        const updatedIndex = removeDocumentFromIndex(documentId);
        setIndexedChunks(updatedIndex);
    }, [setDocuments]);

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
