// src/components/JournalScreen.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function JournalScreen({ onClose, onBranchOut }) {
  const [thoughts, setThoughts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchJournal = async () => {
      try {
        const sessionStr = localStorage.getItem('user_session');
        if (!sessionStr) throw new Error('Сессия не найдена. Перезайдите в систему.');
        const session = JSON.parse(sessionStr);
        const token = session.access_token;

        const apiUrl = 'https://vision-backend-olsz.onrender.com';
        const response = await fetch(`${apiUrl}/api/thoughts`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ошибка загрузки журнала');
        
        setThoughts(data.thoughts || []);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJournal();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div 
      className="w-full max-w-4xl mx-auto flex flex-col gap-6 min-h-[90vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Хедер журнала */}
      <header className="sticky top-0 z-50 w-full glass rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="logo-placeholder !w-9 !h-9 !text-sm">✦</div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Архив [+vision]</span>
        </div>
        <button 
          onClick={onClose}
          className="text-sm px-4 py-1.5 btn-accent !w-auto"
        >
          Назад к мысли
        </button>
      </header>

      {/* Список мыслей */}
      <div className="flex-1 space-y-4 overflow-y-auto max-h-[75vh] pr-2">
        {isLoading && (
          <div className="text-center py-8 opacity-60 animate-pulse">Загрузка архива...</div>
        )}
        
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-center">
            {errorMsg}
          </div>
        )}

        {!isLoading && thoughts.length === 0 && (
          <div className="glass p-8 text-center text-[var(--text-secondary)]">
            Ваш журнал пока пуст. Опубликуйте свою первую мысль!
          </div>
        )}

        {thoughts.map((thought) => (
          <motion.div 
            key={thought.id} 
            className="glass p-5 sm:p-6 flex flex-col gap-3 relative overflow-hidden"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="flex justify-between items-center text-xs text-[var(--text-secondary)] border-b border-[var(--glass-border)] pb-2">
              <span>{formatDate(thought.created_at)}</span>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] font-medium">
                {thought.mode === 'editor' ? 'Редактор' : 'Диалог'}
              </span>
            </div>

            {thought.title && (
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{thought.title}</h2>
            )}
            
            <p className="text-[var(--text-primary)] text-base whitespace-pre-wrap leading-relaxed">
              {thought.text}
            </p>

            {/* Блок действий над архивной мыслью */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => onBranchOut(thought)}
                className="text-xs px-3 py-1.5 btn-outline !w-auto text-[var(--accent)] border-[var(--accent)]"
              >
                ++ мысль (Развить ветку)
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
