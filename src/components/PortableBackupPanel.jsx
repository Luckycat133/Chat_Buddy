import { useEffect, useRef, useState } from 'react';
import { cloudAccountChangedEvent } from '../api/cloud-adapter';
import { buildWebV2Backup } from '../config/apiConfig';
import { parsePortableBackup, readPortableBackup, restorePortableBackup } from '../api/portable-backup';
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
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const fileRef = useRef(null);
    useEffect(() => {
        const reset = () => { setStored(null); setSelection(null); setError(null); };
        window.addEventListener(cloudAccountChangedEvent, reset);
        return () => window.removeEventListener(cloudAccountChangedEvent, reset);
    }, []);
    const run = async (operation) => {
        setBusy(true);
        setError(null);
        try { await operation(); } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    const pick = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setSelection(null);
        if (!file) return;
        void run(async () => {
            if (file.size > MAX_PORTABLE_BACKUP_BYTES) throw Error('Backup exceeds 4 MiB');
            const document = await file.text();
            const data = parsePortableBackup(document);
            setSelection({ document, data });
        });
    };
    return <section className="settings-group" aria-label={label('跨端账号备份', 'Portable account backup')}>
        <p>{label('备份与当前帐号绑定。导入会替换已保存的备份，但不会修改在线聊天、成员身份或权限。附件不可用时保留引用。单个文件最多 4 MiB。', 'A backup is bound to your current account. Import replaces the saved backup, not live conversations, members or permissions. Unavailable attachments retain their references. Maximum 4 MiB.')}</p>
        <button type="button" disabled={busy} onClick={() => void run(async () => {
            const { data } = await readPortableBackup('live');
            const local = await buildWebV2Backup({ requireComplete: true });
            const document = JSON.stringify({ ...local, cloudAccount: data.cloudAccount, ...(data.attachments ? { attachments: data.attachments } : {}) });
            parsePortableBackup(document);
            download(document);
        })}>{label('导出当前账号与本机备份', 'Export current account and browser data')}</button>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{label('选择 Web v2 备份', 'Select a Web v2 backup')}</button>
        <input hidden ref={fileRef} type="file" accept=".json,application/json" onChange={pick} />
        {selection && <button type="button" disabled={busy} onClick={() => void run(async () => {
            await restorePortableBackup(selection.document);
            const reread = await readPortableBackup('stored');
            if (reread.document !== selection.document) throw Error('The stored backup does not match this file');
            setStored(reread);
            setSelection(null);
        })}>{label('导入并替换已保存的备份', 'Import and replace saved backup')}</button>}
        <button type="button" disabled={busy} onClick={() => void run(async () => setStored(await readPortableBackup('stored')))}>{label('读取已导入备份', 'Open imported backup')}</button>
        {stored && <>
            <button type="button" onClick={() => download(stored.document)}>{label('原样重新导出', 'Re-export original backup')}</button>
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
