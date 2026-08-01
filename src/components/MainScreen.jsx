import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AboutModal from './AboutModal';
import JournalScreen from './JournalScreen';

export default function MainScreen() {
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState('editor');
  const [useContext, setUseContext] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'system');
  
  const [viewingJournal, setViewingJournal] = useState(false);
  const [parentThought, setParentThought] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Ссылка для хранения объекта распознавания речи
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef('');
  const speechWasSentRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const apiUrl = 'https://vision-backend-olsz.onrender.com';

  const getValidAccessToken = async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) throw new Error('Пользователь не авторизован');

    const session = JSON.parse(sessionStr);
    const expiresSoon = !session.expires_at || session.expires_at * 1000 < Date.now() + 60_000;
    if (!expiresSoon) return session.access_token;
    if (!session.refresh_token) throw new Error('Сессия истекла. Пожалуйста, войдите снова.');

    const response = await fetch(`${apiUrl}/api/refresh-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    // Preview may temporarily use the previous Render deployment, where the
    // refresh route does not exist yet. That server does not enforce the JWT,
    // so keep the existing token until the backend release is deployed.
    if (response.status === 404) return session.access_token;
    const data = await response.json();
    if (!response.ok || !data.session) {
      throw new Error(data.error || 'Сессия истекла. Пожалуйста, войдите снова.');
    }

    localStorage.setItem('user_session', JSON.stringify(data.session));
    return data.session.access_token;
  };

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
  }, [theme]);
  // Функция текстовой отправки в ИИ-чат
  const handleSend = async (textToSend = inputText) => {
    const trimmedText = textToSend.trim();
    if (!trimmedText || isLoading) return;
    
    setMessages(prev => [...prev, { sender: 'user', text: trimmedText }]);
    setInputText('');
    setIsLoading(true);
    
    try {
      const token = await getValidAccessToken();
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: trimmedText,
          mode: mode,
          use_global_context: useContext,
          parent_thought_id: parentThought ? parentThought.id : null,
          system_prompt: 'Ты ассистент ИИ-Дневника в стиле строгого делового научпопа.'
        })
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Не удалось получить ответ ИИ');
      setMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: `Ошибка связи с сервером: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Метод старта БЕСПЛАТНОГО распознавания речи без внешних API
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Браузер не поддерживает распознавание речи. Используйте диктовку на клавиатуре iPhone.');
      return;
    }

    setVoiceError('');
    setInputText('');
    speechTranscriptRef.current = '';
    speechWasSentRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onerror = (event) => {
      console.error('Ошибка записи:', event.error);
      const errorMessages = {
        'not-allowed': 'Safari не получил доступ к микрофону. Разрешите микрофон для этого сайта в настройках Safari.',
        'service-not-allowed': 'На iPhone недоступно распознавание речи. Проверьте, что Siri включена.',
        'audio-capture': 'iPhone не смог получить звук с микрофона.',
        'network': 'Safari не смог связаться со службой распознавания речи.',
        'no-speech': 'Речь не была распознана. Нажмите микрофон и попробуйте ещё раз.'
      };
      setVoiceError(errorMessages[event.error] || `Не удалось распознать речь: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = async () => {
      setIsRecording(false);
      const transcript = speechTranscriptRef.current.trim();
      if (transcript && !speechWasSentRef.current) {
        speechWasSentRef.current = true;
        await handleSend(transcript);
      } else if (!transcript) {
        setVoiceError((currentError) => currentError || 'Safari завершил запись без текста. Попробуйте ещё раз или используйте микрофон на клавиатуре iPhone.');
      }
    };

    recognition.onresult = async (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      speechTranscriptRef.current = transcript;
      setInputText(transcript);

      const hasFinalResult = Array.from(event.results).some((result) => result.isFinal);
      if (hasFinalResult && transcript && !speechWasSentRef.current) {
        speechWasSentRef.current = true;
        await handleSend(transcript);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error) {
      setVoiceError(`Не удалось запустить микрофон: ${error.message}`);
    }
  };

  // Метод остановки записи звука
  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };
  const handlePublish = async () => {
    if (messages.length === 0 || isPublishing) return;
    
    try {
      const sessionStr = localStorage.getItem('user_session');
      if (!sessionStr) throw new Error('Пользователь не авторизован');
      const session = JSON.parse(sessionStr);
      
      const isEmailConfirmed = session.user?.email_confirmed_at;
      if (!isEmailConfirmed) {
        alert('⚠️ Чтобы ваши мысли надежно сохранились в облачном Журнале, пожалуйста, подтвердите ваш e-mail по ссылке из письма.');
        return;
      }

      setIsPublishing(true);
      const token = session.access_token;

      const fullText = messages
        .filter(msg => msg.sender === 'user')
        .map(msg => msg.text)
        .join('\n\n');

      const apiUrl = 'https://vision-backend-olsz.onrender.com';
      const response = await fetch(`${apiUrl}/api/thoughts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: fullText,
          mode: mode,
          parent_thought_id: parentThought ? parentThought.id : null
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось опубликовать запись');

      alert('Мысль успешно сохранена в вашем облачном Журнале!');
      setMessages([]);
      setHasStarted(false);
      setParentThought(null);
    } catch (error) {
      alert(`Ошибка публикации: ${error.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleBranchOut = (archiveThought) => {
    setParentThought(archiveThought);
    setMode(archiveThought.mode);
    setViewingJournal(false);
    setHasStarted(true);
    setMessages([
      { sender: 'user', text: `[Развитие мысли от ${new Date(archiveThought.created_at).toLocaleDateString()}]: ${archiveThought.text}` },
      { sender: 'ai', text: 'Контекст принят. Готов помочь развить эту концепцию. Что именно мы изменим или добавим?' }
    ]);
  };

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    window.location.reload(); 
  };

  if (viewingJournal) {
    return (
      <JournalScreen 
        onClose={() => setViewingJournal(false)} 
        onBranchOut={handleBranchOut}
      />
    );
  }

  const isContextDisabled = messages.length > 0;
  const showPublishButton = messages.some(msg => msg.sender === 'ai');
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 min-h-[90vh] relative">
      <header className="sticky top-0 z-50 w-full glass rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="logo-placeholder !w-9 !h-9 !text-sm">✦</div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            [+vision] {parentThought && <span className="text-[var(--accent)]">(ветка ++)</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setViewingJournal(true)}
            className="text-sm px-4 py-1.5 glass rounded-full hover:text-[var(--accent)] transition-colors"
          >
            Журнал
          </button>
          <button 
            onClick={() => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')}
            className="px-3 py-1.5 text-xs font-medium rounded-xl glass text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
          >
            {theme === 'system' ? '🌓 Системная' : theme === 'light' ? '☀️ Светлая' : '🌙 Темная'}
          </button>
          <button onClick={() => setIsAboutOpen(true)} className="text-sm px-4 py-1.5 glass rounded-full hover:text-[var(--accent)] transition-colors">О сервисе</button>
          <button onClick={handleLogout} className="text-sm px-3 py-1.5 glass rounded-full text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all">Выйти</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <motion.div 
              key="start-screen" 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-x-0 bottom-[15vh] flex flex-col items-center justify-center"
            >
              <button 
                onClick={() => setHasStarted(true)} 
                className="px-8 py-4 rounded-full glass font-light text-xl tracking-wide hover:text-[var(--accent)] border border-[var(--glass-border)] hover:border-[var(--accent)] hover:scale-102 active:scale-98 transition-all duration-300 shadow-xl text-[var(--text-primary)]"
              >
                + мысль
              </button>
            </motion.div>
          ) : (
            <motion.div key="chat-screen" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass p-6 sm:p-8 flex flex-col h-[70vh] w-full">
              {/* Исправлено: Отрегулированы все открывающие и закрывающие теги блока переключателей */}
              <div className="flex flex-wrap gap-4 mb-4 items-center">
                <button onClick={() => !isContextDisabled && setMode('editor')} disabled={isContextDisabled} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'editor' ? 'btn-accent !w-auto' : 'glass opacity-60'} ${isContextDisabled && mode !== 'editor' ? 'hidden' : ''}`}>Редактор</button>
                <button onClick={() => !isContextDisabled && setMode('discuss')} disabled={isContextDisabled} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'discuss' ? 'btn-accent !w-auto' : 'glass opacity-60'} ${isContextDisabled && mode !== 'discuss' ? 'hidden' : ''}`}>Обсудить</button>
                <label className={`ml-auto flex items-center gap-2 text-sm text-[var(--text-secondary)] ${isContextDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={useContext} disabled={isContextDisabled} onChange={(e) => setUseContext(e.target.checked)} className="rounded" />
                  Учитывать контекст
                </label>
              </div>
              
              {/* Поток вывода сообщений пользователя и ответов ИИ */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`p-4 rounded-2xl max-w-[80%] ${msg.sender === 'user' ? 'ml-auto btn-accent !w-auto text-white' : 'glass'}`}>{msg.text}</div>
                ))}
                {isLoading && (
                  <div className="glass p-4 rounded-2xl max-w-[40%] animate-pulse text-sm text-[var(--text-secondary)]">ИИ анализирует...</div>
                )}
              </div>

              {/* Нижняя панель ввода и кнопка бесплатного системного микрофона */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                    className="glass-input flex-1" 
                    placeholder={isRecording ? "Идет запись голоса... Говорите" : isLoading ? "Ожидайте ответа..." : "Запишите или надиктовывайте мысль..."} 
                    disabled={isLoading || isRecording} 
                  />
                  
                  {inputText.trim() === "" ? (
                    <button 
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording} 
                      className={`px-5 py-3 rounded-xl font-medium transition-all ${isRecording ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'glass hover:text-[var(--accent)]'}`}
                      disabled={isLoading}
                    >
                      {isRecording ? '⏹️' : '🎙️'}
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleSend()} className="btn-accent !w-auto px-6" disabled={isLoading}>➔</button>
                  )}
                </div>

                {voiceError && (
                  <p className="text-xs text-red-400 px-1" role="alert">{voiceError}</p>
                )}
                
                {showPublishButton && (
                  <motion.button 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="btn-outline !w-full py-2.5 text-sm font-semibold tracking-wide border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-soft)]" 
                    onClick={handlePublish}
                    disabled={isPublishing}
                  >
                    {isPublishing ? 'Публикация мыслей...' : '📥 Опубликовать в Журнал'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
    </div>
  );
}
