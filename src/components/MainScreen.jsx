import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AboutModal from './AboutModal';

export default function MainScreen() {
  const [hasStarted, setHasStarted] = useState(false); // Открыт ли чат через «+мысль»
  const [mode, setMode] = useState('editor'); // 'editor' | 'discuss'
  const [useContext, setUseContext] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'system');

  // Управление темами оформления (Системная / Светлая / Темная)
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      const isDark = theme === 'system' ? mq.matches : theme === 'dark';
      root.classList.toggle('dark', isDark);
      root.setAttribute('data-theme', theme);
    };

    applyTheme();
    localStorage.setItem('app_theme', theme);

    if (theme === 'system') {
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputText('');
    setIsLoading(true);
    
    try {
      const apiUrl = import.meta.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userText,
          mode: mode,
          use_global_context: useContext,
          system_prompt: 'Ты ассистент ИИ-Дневника в стиле строгого делового научпопа.'
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: `Ошибка связи с сервером: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Правило из ТЗ: Блокируем настройки, если в чате уже есть сообщения
  const isContextDisabled = messages.length > 0;
  // Правило из ТЗ: Кнопка опубликовать появляется только после ответа ИИ
  const showPublishButton = messages.some(msg => msg.sender === 'ai');

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      {/* Умная Шапка (Header) из ТЗ */}
      <header className="sticky top-0 z-50 w-full glass rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="logo-placeholder !w-9 !h-9 !text-sm">✦</div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">[+vision]</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Переключатель тем (3 состояния по клику) */}
          <button 
            onClick={() => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')}
            className="px-3 py-1.5 text-xs font-medium rounded-xl glass text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
          >
            {theme === 'system' ? '🌓 Системная' : theme === 'light' ? '☀️ Светлая' : '🌙 Темная'}
          </button>
          <button onClick={() => setIsAboutOpen(true)} className="text-sm px-4 py-1.5 glass rounded-full hover:text-[var(--accent)] transition-colors">О сервисе</button>
        </div>
      </header>

      {/* Основной контент */}
      <AnimatePresence mode="wait">
        {!hasStarted ? (
          /* ЭКРАН 1: Приветственная кнопка «+мысль» по ТЗ */
          <motion.div 
            key="start-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center min-h-[40vh] gap-4"
          >
            <button 
              onClick={() => setHasStarted(true)}
              className="w-20 h-20 rounded-full glass flex items-center justify-center text-3xl font-light hover:text-[var(--accent)] hover:scale-105 transition-all duration-300 shadow-lg"
            >
              ＋
            </button>
            <p className="text-sm font-medium tracking-wide text-[var(--text-secondary)] uppercase">Зафиксировать мысль</p>
          </motion.div>
        ) : (
          /* ЭКРАН 2: Полноценное рабочее окно чата */
          <motion.div 
            key="chat-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-6 sm:p-8 flex flex-col h-[70vh]"
          >
            {/* Панель опций из ТЗ */}
            <div className="flex flex-wrap gap-4 mb-4 items-center">
              <button onClick={() => !isContextDisabled && setMode('editor')} disabled={isContextDisabled} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'editor' ? 'btn-accent !w-auto' : 'glass opacity-60'} ${isContextDisabled && mode !== 'editor' ? 'hidden' : ''}`}>Редактор</button>
              <button onClick={() => !isContextDisabled && setMode('discuss')} disabled={isContextDisabled} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'discuss' ? 'btn-accent !w-auto' : 'glass opacity-60'} ${isContextDisabled && mode !== 'discuss' ? 'hidden' : ''}`}>Обсудить</button>
              
              <label className={`ml-auto flex items-center gap-2 text-sm text-[var(--text-secondary)] ${isContextDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={useContext} disabled={isContextDisabled} onChange={(e) => setUseContext(e.target.checked)} className="rounded" />
                Учитывать контекст
              </label>
            </div>

            {/* Окно сообщений */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {messages.map((msg, i) => (
                <div key={i} className={`p-4 rounded-2xl max-w-[80%] ${msg.sender === 'user' ? 'ml-auto btn-accent !w-auto text-white' : 'glass'}`}>{msg.text}</div>
              ))}
              {isLoading && (
                <div className="glass p-4 rounded-2xl max-w-[40%] animate-pulse text-sm text-[var(--text-secondary)]">ИИ анализирует...</div>
              )}
            </div>

            {/* Зона ввода */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 items-center">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} className="glass-input flex-1" placeholder={isLoading ? "Ожидайте ответа..." : "Запишите вашу мысль..."} disabled={isLoading} />
                <button onClick={handleSend} className="btn-accent !w-auto px-6" disabled={isLoading}>➔</button>
              </div>

              {/* Появление кнопки Опубликовать строго по ТЗ */}
              {showPublishButton && (
                <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="btn-outline !w-full py-2.5 text-sm font-semibold tracking-wide border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  onClick={() => alert('Мысль успешно сохранена в постоянный Журнал публикаций!')}
                >
                  📥 Опубликовать в Журнал
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
    </div>
  );
}
