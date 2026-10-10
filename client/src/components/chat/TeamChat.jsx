import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Users, MoreHorizontal, Pencil, Trash2, Smile } from 'lucide-react';
import useChatStore from '../../stores/useChatStore.js';
import useAuthStore from '../../stores/useAuthStore.js';

const EMOJIS = ['👍', '❤️', '😂', '🚀', '✅'];

function formatTime(value) {
  const date = new Date(value);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TeamChat({ roomId, socket, users = [] }) {
  const { user } = useAuthStore();
  const { messages, typingUsers, unreadCount, loading, error, hasMore, fetchMessages, addMessage, updateMessage, updateReactions, setTyping, markRead, setActive } = useChatStore();
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(null);
  const [showReactions, setShowReactions] = useState(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    fetchMessages(roomId);
    setActive(true);
    return () => setActive(false);
  }, [roomId]);

  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (message) => addMessage(message, user?._id);
    const onUpdate = (message) => updateMessage(message);
    const onTypingStart = (payload) => setTyping(payload, true);
    const onTypingStop = (payload) => setTyping(payload, false);
    const onReaction = (payload) => updateReactions(payload);
    socket.on('chat:message', onMessage);
    socket.on('chat:message:update', onUpdate);
    socket.on('chat:typing:start', onTypingStart);
    socket.on('chat:typing:stop', onTypingStop);
    socket.on('chat:reaction', onReaction);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:message:update', onUpdate);
      socket.off('chat:typing:start', onTypingStart);
      socket.off('chat:typing:stop', onTypingStop);
      socket.off('chat:reaction', onReaction);
    };
  }, [socket, user?._id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    markRead();
  }, [messages.length]);

  const send = () => {
    const content = input.trim();
    if (!content || !socket) return;
    const clientMessageId = `${user._id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addMessage({ _id: `client-${clientMessageId}`, clientMessageId, content, sender: user, createdAt: new Date().toISOString(), status: 'sending' }, user._id);
    socket.emit('chat:send', { roomId, content, clientMessageId }, (result) => {
      if (!result?.success) updateMessage({ _id: `client-${clientMessageId}`, content: `${content} (failed to send)`, status: 'failed' });
    });
    setInput('');
    socket.emit('chat:typing:stop', { roomId });
  };

  const onInput = (event) => {
    setInput(event.target.value);
    if (!socket) return;
    socket.emit('chat:typing:start', { roomId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('chat:typing:stop', { roomId }), 1200);
  };

  const submitEdit = () => {
    if (!editing || !input.trim()) return;
    socket?.emit('chat:edit', { roomId, messageId: editing._id, content: input.trim() });
    setEditing(null);
    setInput('');
  };

  const remove = (message) => socket?.emit('chat:delete', { roomId, messageId: message._id });

  return (
    <section className="h-full flex flex-col bg-black/20">
      <header className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-accent" />
          <span className="text-xs font-bold tracking-widest font-mono">TEAM CHAT</span>
          {unreadCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px]">{unreadCount}</span>}
        </div>
        <div className="flex items-center gap-1 text-text-muted text-[10px] font-mono"><Users size={13} /> {users.length} online</div>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && !messages.length && <div className="text-center text-text-muted text-xs font-mono py-8">Loading team chat...</div>}
        {!loading && !messages.length && <div className="text-center text-text-muted text-xs font-mono py-10"><p className="text-text mb-1">Start a conversation</p><p>Discuss code, bugs, and ideas.</p></div>}
        {hasMore && <button onClick={() => fetchMessages(roomId, messages[0]?._id)} className="w-full text-[10px] text-primary font-mono">Load older messages</button>}
        {messages.map((message, index) => {
          const mine = String(message.sender?._id) === String(user?._id);
          const previous = messages[index - 1];
          const grouped = previous && String(previous.sender?._id) === String(message.sender?._id);
          return (
            <div key={message._id || message.clientMessageId} className={`flex gap-2 ${mine ? 'justify-end' : ''}`}>
              {!mine && !grouped && <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] text-primary">{message.sender?.username?.slice(0, 2).toUpperCase()}</div>}
              <div className={`max-w-[85%] group ${mine ? 'items-end' : ''}`}>
                {!mine && !grouped && <div className="text-[10px] text-primary font-mono mb-0.5">{message.sender?.username}</div>}
                <div className={`relative rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${mine ? 'bg-primary/15 border border-primary/25' : 'bg-white/5 border border-border/40'} ${message.deletedAt ? 'italic text-text-muted' : ''}`}>
                  {message.content}
                  <span className="block text-[9px] text-text-muted mt-1">{formatTime(message.createdAt)} {message.editedAt && '· edited'} {message.status === 'sending' && '· sending'}</span>
                  {mine && !message.deletedAt && message.status !== 'sending' && <div className="hidden group-hover:flex absolute -top-7 right-0 gap-1 bg-background border border-border/50 rounded p-1"><button onClick={() => { setEditing(message); setInput(message.content); }}><Pencil size={11} /></button><button onClick={() => remove(message)}><Trash2 size={11} /></button></div>}
                </div>
                {!message.deletedAt && <div className="relative"><button onClick={() => setShowReactions(showReactions === message._id ? null : message._id)} className="text-text-muted opacity-0 group-hover:opacity-100"><Smile size={11} /></button>{showReactions === message._id && <div className="absolute z-10 bg-background border border-border rounded px-1 py-0.5">{EMOJIS.map((emoji) => <button key={emoji} onClick={() => { socket?.emit('chat:reaction', { roomId, messageId: message._id, emoji }); setShowReactions(null); }} className="p-1">{emoji}</button>)}</div>}</div>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {typingUsers.length > 0 && <div className="px-4 text-[10px] text-text-muted font-mono">{typingUsers.map((item) => item.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</div>}
      {error && <div className="px-3 py-1 text-[10px] text-red-400">{error}</div>}
      <div className="p-3 border-t border-border/40">
        {editing && <div className="flex justify-between text-[10px] text-text-muted mb-1">Editing message <button onClick={() => { setEditing(null); setInput(''); }}>Cancel</button></div>}
        <div className="flex items-end gap-2">
          <textarea value={input} onChange={onInput} onBlur={() => socket?.emit('chat:typing:stop', { roomId })} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); editing ? submitEdit() : send(); } }} placeholder="Message your team..." rows={1} maxLength={4000} className="flex-1 resize-none bg-black/40 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent/60" />
          <button onClick={editing ? submitEdit : send} className="p-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25"><Send size={14} /></button>
        </div>
      </div>
    </section>
  );
}
