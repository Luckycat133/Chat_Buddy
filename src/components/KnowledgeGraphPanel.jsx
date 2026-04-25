/**
 * T15: KnowledgeGraphPanel
 * View the knowledge graph and add custom concept nodes for Sensei.
 */
import React, { useState, useMemo } from 'react';
import { X, Network, Plus, Trash2, Search, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { KNOWLEDGE_NODES, KNOWLEDGE_EDGES, getPrerequisites } from '../data/knowledgeGraph';
import { cn } from '../utils/cn';

const CUSTOM_KG_KEY = 'chat-buddy-custom-kg-nodes';

function loadCustomNodes() {
    try {
        const raw = localStorage.getItem(CUSTOM_KG_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveCustomNodes(nodes) {
    try {
        localStorage.setItem(CUSTOM_KG_KEY, JSON.stringify(nodes));
    } catch { /* ignore */ }
}

const CATEGORY_COLORS = {
    math: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    programming: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    science: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    language: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    work: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    custom: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

function NodeCard({ node, language, onDelete, isCustom }) {
    const prereqs = getPrerequisites(node.id).slice(0, 3);
    const colorCls = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.custom;

    return (
        <div className="flex items-start gap-3 p-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-white)]">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--color-text-main)]">
                        {language === 'zh' ? (node.name_zh || node.name) : node.name}
                    </span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', colorCls)}>
                        {node.category}
                    </span>
                    {node.difficulty && (
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                            {'⭐'.repeat(node.difficulty)}
                        </span>
                    )}
                </div>
                {node.description && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                        {language === 'zh' ? (node.description_zh || node.description) : node.description}
                    </p>
                )}
                {prereqs.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-[10px] text-[var(--color-text-muted)]">Requires:</span>
                        {prereqs.map(p => (
                            <span key={p} className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
                                {p}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            {isCustom && (
                <button
                    onClick={() => onDelete(node.id)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[var(--radius-sm)] transition-colors shrink-0"
                >
                    <Trash2 size={13} />
                </button>
            )}
        </div>
    );
}

export default function KnowledgeGraphPanel({ onClose }) {
    const { t, language } = useLanguage();
    const [customNodes, setCustomNodes] = useState(loadCustomNodes);
    const [search, setSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newNode, setNewNode] = useState({ name: '', name_zh: '', category: 'custom', description: '', prerequisites: '' });
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'custom'

    const allNodes = useMemo(() => [
        ...KNOWLEDGE_NODES.map(n => ({ ...n, isCustom: false })),
        ...customNodes.map(n => ({ ...n, isCustom: true }))
    ], [customNodes]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return allNodes.filter(n => {
            if (activeTab === 'custom' && !n.isCustom) return false;
            if (!q) return true;
            return n.name?.toLowerCase().includes(q) || n.name_zh?.includes(q) || n.category?.includes(q);
        });
    }, [allNodes, search, activeTab]);

    const handleAddNode = () => {
        if (!newNode.name.trim()) return;
        const node = {
            id: `custom-${Date.now()}`,
            name: newNode.name.trim(),
            name_zh: newNode.name_zh.trim() || newNode.name.trim(),
            category: newNode.category || 'custom',
            description: newNode.description.trim(),
            prerequisites: newNode.prerequisites.split(',').map(s => s.trim()).filter(Boolean),
            isCustom: true,
        };
        const updated = [node, ...customNodes];
        setCustomNodes(updated);
        saveCustomNodes(updated);
        setNewNode({ name: '', name_zh: '', category: 'custom', description: '', prerequisites: '' });
        setShowAddForm(false);
    };

    const handleDeleteCustom = (nodeId) => {
        const updated = customNodes.filter(n => n.id !== nodeId);
        setCustomNodes(updated);
        saveCustomNodes(updated);
    };

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg glass-crystal rounded-[var(--radius-2xl)] shadow-floating flex flex-col max-h-[85vh] overflow-hidden animate-scale-spring">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                            <Network size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-[var(--color-text-main)]">{t('kg_title')}</h2>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {KNOWLEDGE_NODES.length} {t('kg_builtin')} · {customNodes.length} {t('kg_custom')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Search + Tabs */}
                <div className="px-5 pt-3 pb-2 space-y-2 border-b border-[var(--color-border)]">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('kg_search_placeholder')}
                            className="w-full input-modern pl-8 text-sm py-2"
                        />
                    </div>
                    <div className="flex gap-1">
                        {[['all', t('kg_all')], ['custom', t('kg_custom_only')]].map(([tab, label]) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                                    activeTab === tab
                                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Node List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-2">
                    {filtered.map(node => (
                        <NodeCard
                            key={node.id}
                            node={node}
                            language={language}
                            onDelete={handleDeleteCustom}
                            isCustom={node.isCustom}
                        />
                    ))}
                    {filtered.length === 0 && (
                        <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                            {t('kg_no_results')}
                        </div>
                    )}
                </div>

                {/* Add Custom Node Form */}
                {showAddForm && (
                    <div className="px-5 pb-3 pt-3 border-t border-[var(--color-border)] space-y-2.5 bg-[var(--color-bg-hover)]">
                        <p className="text-xs font-semibold text-[var(--color-text-main)]">{t('kg_add_node')}</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder={t('kg_name_en')} value={newNode.name} onChange={e => setNewNode(p => ({ ...p, name: e.target.value }))} className="input-modern text-xs py-2" />
                            <input type="text" placeholder={t('kg_name_zh')} value={newNode.name_zh} onChange={e => setNewNode(p => ({ ...p, name_zh: e.target.value }))} className="input-modern text-xs py-2" />
                        </div>
                        <input type="text" placeholder={t('kg_description')} value={newNode.description} onChange={e => setNewNode(p => ({ ...p, description: e.target.value }))} className="w-full input-modern text-xs py-2" />
                        <input type="text" placeholder={t('kg_prerequisites_hint')} value={newNode.prerequisites} onChange={e => setNewNode(p => ({ ...p, prerequisites: e.target.value }))} className="w-full input-modern text-xs py-2" />
                        <div className="flex gap-2">
                            <button onClick={handleAddNode} className="flex-1 py-2 rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90">{t('add')}</button>
                            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-[var(--radius-lg)] text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]">{t('cancel')}</button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                {!showAddForm && (
                    <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border)]">
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-xl)] bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
                        >
                            <Plus size={15} />
                            {t('kg_add_concept')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
