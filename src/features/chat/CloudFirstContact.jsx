import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authedCloudFetch } from '../../api/cloud-adapter';
import { useLanguage } from '../../context/LanguageContext';

export default function CloudFirstContact() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [otherChats, setOtherChats] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await authedCloudFetch('/v1/onboarding/bootstrap', { method: 'POST' });
        // A deleted first contact is not a chat-list outage. Do not create
        // or reveal it, but still load all other authorized conversations.
        if (!response.ok && response.status !== 404) throw new Error('First contact unavailable');
        const next = response.ok ? await response.json() : null;
        const list = await authedCloudFetch('/v1/conversations');
        if (!list.ok) throw new Error('Chat list unavailable');
        const { items } = await list.json();
        if (active) {
          setContact(next);
          setLoaded(true);
          setOtherChats(items.filter((item) =>
            item.id !== next?.conversationId && item.memberStatus === 'active'));
        }
      } catch {
        if (active) setLoadError(true);
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);

  return (
    <section data-testid="chat-list" className="relative h-full overflow-auto p-5">
      <h1 className="mb-4 text-xl font-semibold">{t('nav_chats')}</h1>
      {loadError ? (
        <>
          <p role="alert">{t('first_contact_failed')}</p>
          <button type="button" onClick={() => { setLoadError(false); setAttempt((value) => value + 1); }}>
            {t('first_contact_retry')}
          </button>
        </>
      ) : !loaded ? <p role="status">{t('first_contact_loading')}</p> : contact ? (
        <button
          type="button"
          data-testid="first-contact-mira"
          onClick={() => navigate('/chats/' + encodeURIComponent(contact.conversationId))}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-[var(--color-border)] p-4 text-left"
        >
          <strong>{t('first_contact_mira')}</strong>
          {contact.preview && <span>{contact.preview}</span>}
          {contact.unread && <span data-testid="first-contact-unread">{t('first_contact_unread')}</span>}
        </button>
      ) : otherChats.length === 0 ? <p>{t('cloud_chat_empty_hint')}</p> : null}
      {otherChats.map((chat) => (
        <Link key={chat.id} className="block p-4" to={'/chats/' + encodeURIComponent(chat.id)}>
          {chat.publicName && !chat.publicName.startsWith('onboarding:')
            ? chat.publicName : t('first_contact_other_chat')}
        </Link>
      ))}
    </section>
  );
}
