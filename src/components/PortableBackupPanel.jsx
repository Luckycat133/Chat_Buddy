import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { cloudAccountChangedEvent } from '../api/cloud-adapter';
import { buildWebV2Backup } from '../config/apiConfig';
import { parsePortableBackup, portableArchiveHash, readPortableBackup, requestPortableMerge, restorePortableBackup, StaleMergePreviewError } from '../api/portable-backup';
import { MAX_PORTABLE_BACKUP_BYTES } from '../../shared/contracts/portable-backup';

function download(document) {
    const url = URL.createObjectURL(new Blob([document], { type: 'application/json' }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = 'chat-buddy-web-v2.json';
    window.document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
}

const imagePattern = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/;

function localChats(data) {
    const main = data.indexedDB['chat-buddy-main']?.kv.find(row => row.key === 'chat-buddy-chats');
    let records = main?.value ?? data.localStorage['chat-buddy-chats'] ?? data.localStorage['chat-buddy:chat-buddy-chats'];
    if (typeof records === 'string') {
        try { records = JSON.parse(records); } catch { return []; }
    }
    if (!Array.isArray(records)) return [];
    return records.filter(row => row && typeof row.id === 'string').map(row => ({
        ...row, messages: Array.isArray(row.messages)
            ? row.messages.filter(msg => msg && typeof msg.id === 'string' && typeof msg.content === 'string') : [],
    }));
}

function localMedia(data, message) {
    const images = data.indexedDB['chat-buddy-images']?.images ?? [];
    const ids = new Set(Array.isArray(message.attachmentIds) ? message.attachmentIds.filter(id => typeof id === 'string') : []);
    if (message.content.startsWith('[IMG:') && message.content.endsWith(']')) {
        ids.add(message.content.slice(5, -1));
    }
    if (message.content.startsWith('[FILE]')) ids.add(message.content.slice(6).trim());
    return [...ids].map((id, index) => {
        const source = images.find(image => image.id === id)?.data ?? id;
        return imagePattern.test(source) ? { id: imagePattern.test(id) ? `inline-image-${index}` : id, data: source } : { id };
    });
}

export function PortableBackupPanel({ chinese }) {
    const label = (zh, en) => chinese ? zh : en;
    const [selection, setSelection] = useState(null);
    const [stored, setStored] = useState(null);
    const [merge, setMerge] = useState(null);
    const [result, setResult] = useState(null);
    const [confirmed, setConfirmed] = useState(false);
    const resetMerge = () => { setMerge(null); setResult(null); setConfirmed(false); };
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const fileRef = useRef(null);
    const accountEpoch = useRef(0);
    useEffect(() => {
        const reset = () => { ++accountEpoch.current; setBusy(false); setStored(null); setSelection(null); setError(null); resetMerge(); };
        window.addEventListener(cloudAccountChangedEvent, reset);
        return () => window.removeEventListener(cloudAccountChangedEvent, reset);
    }, []);
    const run = async (operation) => {
        const epoch = accountEpoch.current;
        const current = () => epoch === accountEpoch.current;
        const ensureCurrent = () => { if (!current()) throw Error('The signed-in account changed'); };
        setBusy(true);
        setError(null);
        try { await operation(ensureCurrent); } catch (err) { if (current()) setError(err.message); }
        finally { if (current()) setBusy(false); }
    };
    const pick = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setSelection(null);
        resetMerge();
        if (!file) return;
        void run(async (ensureCurrent) => {
            if (file.size > MAX_PORTABLE_BACKUP_BYTES) throw Error('Backup exceeds 4 MiB');
            const document = await file.text();
            const data = parsePortableBackup(document);
            ensureCurrent();
            setSelection({ document, data });
        });
    };
    return <section className="settings-group" aria-label={label('跨端账号备份', 'Portable account backup')}>
        <p>{label('备份与当前帐号绑定。导入会替换已保存的备份，但不会修改在线聊天、成员身份或权限。附件不可用时保留引用。单个文件最多 4 MiB。', 'A backup is bound to your current account. Import replaces the saved backup, not live conversations, members or permissions. Unavailable attachments retain their references. Maximum 4 MiB.')}</p>
        <button type="button" disabled={busy} onClick={() => void run(async (ensureCurrent) => {
            const { data } = await readPortableBackup('live');
            const local = await buildWebV2Backup({ requireComplete: true });
            const document = JSON.stringify({ ...local, cloudAccount: data.cloudAccount, ...(data.attachments ? { attachments: data.attachments } : {}) });
            parsePortableBackup(document);
            ensureCurrent();
            download(document);
        })}>{label('导出当前账号与本机备份', 'Export current account and browser data')}</button>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{label('选择 Web v2 备份', 'Select a Web v2 backup')}</button>
        <input hidden ref={fileRef} type="file" accept=".json,application/json" onChange={pick} />
        {selection && <button type="button" disabled={busy} onClick={() => void run(async (ensureCurrent) => {
            resetMerge();
            await restorePortableBackup(selection.document);
            const reread = await readPortableBackup('stored');
            if (reread.document !== selection.document) throw Error('The stored backup does not match this file');
            ensureCurrent();
            setStored(reread);
            setSelection(null);
        })}>{label('导入并替换已保存的备份', 'Import and replace saved backup')}</button>}
        <button type="button" disabled={busy} onClick={() => void run(async (ensureCurrent) => { resetMerge(); const archive = await readPortableBackup('stored'); ensureCurrent(); setStored(archive); })}>{label('读取已导入备份', 'Open imported backup')}</button>
        {stored && <>
            <button type="button" onClick={() => download(stored.document)}>{label('原样重新导出', 'Re-export original backup')}</button>
            <p>{label('合并只补入你自己发送的受支持消息。只有在服务端仍有完整可信记录时才恢复已删私有会话；共享、找不到的会话和冲突不修改。本机数据和权限不变。', 'Merge only adds supported messages you sent in private conversations without another human participant. Deleted private conversations require complete trusted server records. Shared or unavailable conversations and conflicts are unchanged. Browser data and permissions are unchanged.')}</p>
            <button type="button" disabled={busy} onClick={() => void run(async (ensureCurrent) => {
                resetMerge();
                const preview = await requestPortableMerge();
                if (preview.archiveSha256 !== await portableArchiveHash(stored.document)) {
                    throw Error(label('已存档案已变更，请重新打开。', 'The stored archive changed. Open it again.'));
                }
                ensureCurrent();
                setMerge(preview);
            })}>{label('预览在线合并', 'Preview online merge')}</button>
            {merge?.unsupportedConversationIds?.length > 0 && <p>{label('部分会话缺少完整可信记录，或不符合私有会话条件，不会恢复。', 'Conversations without complete trusted records or that are not private cannot be restored.')}</p>}
            {merge && <section aria-label={label('合并差异', 'Merge differences')}>
                <ul>{Object.entries(merge.counts).map(([key, row]) => <li key={key}>
                    {{ conversations: label('会话', 'Conversations'), messages: label('消息', 'Messages'), attachments: label('附件', 'Attachments') }[key]}:
                    {' '}{row.insert} {label('新增', 'to add')}; {row.skip} {label('跳过', 'skipped')}; {row.conflict} {label('冲突', 'conflicts')}
                    {merge.conflicts?.[key]?.length > 0 && <details><summary>{label('显示档案中的冲突 ID（最多 50 个）', 'Show conflicting archive IDs (up to 50)')}</summary>
                        <ul>{merge.conflicts[key].map(id => <li key={id}><code>{id}</code></li>)}</ul>
                    </details>}
                </li>)}</ul>
                {(merge.counts.messages.insert > 0 || merge.counts.conversations.insert > 0) && <>
                    <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
                        {label('我确认将预览中的新增消息写入在线会话。', 'I confirm adding the previewed messages to live conversations.')}
                    </label>
                    <button type="button" disabled={busy || !confirmed} onClick={() => void run(async (ensureCurrent) => {
                        try { const receipt = await requestPortableMerge(merge.previewToken); ensureCurrent(); setResult(receipt); }
                        catch (err) { if (err instanceof StaleMergePreviewError) throw Error(label('预览已过期或数据已更改，请重新预览。', 'Preview expired or data changed. Preview again.'), { cause: err }); throw err; }
                        finally { ensureCurrent(); setMerge(null); setConfirmed(false); }
                    })}>{label('确认合并到在线会话', 'Confirm merge to live conversations')}</button>
                </>}
            </section>}
            {result && <>
                <p role="status">{label(`已新增 ${result.counts.messages.insert} 条消息。`, `Added ${result.counts.messages.insert} messages.`)}</p>
                {result.counts.conversations.insert > 0 && <p>{label(`已恢复 ${result.counts.conversations.insert} 个私有会话。`, `Restored ${result.counts.conversations.insert} private conversations.`)}</p>}
                <ul>{result.affectedConversationIds.map(id => <li key={id}><Link to={`/chats/${id}?restoredFrom=${result.affectedConversationStarts[id]}`}>
                    {label('查看恢复的在线消息', 'Open restored messages')}: {stored.data.cloudAccount?.conversations.find(thread => thread.id === id)?.publicName || id}
                </Link></li>)}</ul>
            </>}
            {localChats(stored.data).map(thread => <details key={'local:' + thread.id}>
                <summary>{thread.name || thread.id}</summary>
                {thread.messages?.map(message => <article key={message.id}>
                    <p><small>{message.senderId}</small></p>
                    {!message.content.startsWith('[IMG:') && <p>{message.content}</p>}
                    {localMedia(stored.data, message).map(item => <div key={item.id}>
                        {item.data ? <img loading="lazy" src={item.data} alt={item.id} />
                            : <span>{item.id} ({label('附件占位', 'attachment placeholder')})</span>}
                    </div>)}
                </article>)}
            </details>)}
            {stored.data.cloudAccount?.conversations.map(thread => <details key={thread.id}>
                <summary>{thread.publicName || thread.id}</summary>
                {thread.messages.map(message => <article key={message.id}>
                    <p><small>{message.senderActorId}</small></p>
                    <p>{message.content}</p>
                    {message.attachmentIds?.map(id => {
                        const attachment = stored.data.attachments?.find(item => item.id === id);
                        const inline = attachment?.contentBase64 && ['image/png', 'image/jpeg'].includes(attachment.mimeType);
                        return <div key={id}>{inline
                            ? <img loading="lazy" alt={attachment.name} src={`data:${attachment.mimeType};base64,${attachment.contentBase64}`} />
                            : <span>{attachment?.name || id} ({label('附件占位', 'attachment placeholder')})</span>}</div>;
                    })}
                </article>)}
            </details>)}
        </>}
        {error && <p role="alert">{error}</p>}
    </section>;
}
