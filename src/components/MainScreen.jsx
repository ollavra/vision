import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AboutModal from './AboutModal';
import JournalScreen from './JournalScreen';
import EntryEditor from './EntryEditor';

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
  const [isFormattingVoice, setIsFormattingVoice] = useState(false);
  const [isGeneratingEntry, setIsGeneratingEntry] = useState(false);
  const [entryDraft, setEntryDraft] = useState(null);
  const [entryCreatedAt, setEntryCreatedAt] = useState(null);

  // Ссылка для хранения объекта распознавания речи
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef('');
  const speechWasSentRef = useRef(false);
  const voiceSubmissionInFlightRef = useRef(false);
  const lastVoiceSubmissionRef = useRef({ fingerprint: '', submittedAt: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const apiUrl = 'https://vision-backend-olsz.onrender.com';

  const normalizeWords = (text) => (
    String(text).toLocaleLowerCase('ru-RU').match(/[\p{L}\p{N}]+/gu) || []
  );

  const applyPunctuationToOriginalWords = (original, formatted) => {
    const originalWords = String(original).match(/[\p{L}\p{N}]+/gu) || [];
    const formattedMatches = Array.from(String(formatted).matchAll(/[\p{L}\p{N}]+/gu));
    if (originalWords.length === 0) return original;

    const normalizedOriginal = normalizeWords(original);
    const normalizedFormatted = normalizeWords(formatted);
    if (originalWords.length !== formattedMatches.length) {
      let formattedCursor = 0;
      const restored = originalWords.map((word, index) => {
        const matchIndex = normalizedFormatted.findIndex((candidate, candidateIndex) => (
          candidateIndex >= formattedCursor && candidateIndex <= formattedCursor + 5 && candidate === normalizedOriginal[index]
        ));
        if (matchIndex < 0) return word;

        formattedCursor = matchIndex + 1;
        const match = formattedMatches[matchIndex];
        const nextStart = formattedMatches[matchIndex + 1]?.index ?? String(formatted).length;
        const separator = String(formatted).slice(match.index + match[0].length, nextStart);
        const punctuation = separator.match(/[,.!?;:—–-]+/)?.[0] || '';
        const safeWord = index === 0
          ? `${word[0].toLocaleUpperCase('ru-RU')}${word.slice(1)}`
          : word;
        return `${safeWord}${punctuation}`;
      });
      const restoredText = restored.join(' ').trim();
      return /[.!?]$/.test(restoredText) ? restoredText : `${restoredText}.`;
    }

    const matchingPositions = normalizedOriginal.filter((word, index) => word === normalizedFormatted[index]).length;
    if (matchingPositions / originalWords.length < 0.8) {
      const capitalized = `${originalWords[0][0].toLocaleUpperCase('ru-RU')}${originalWords[0].slice(1)}`;
      return `${[capitalized, ...originalWords.slice(1)].join(' ')}.`;
    }

    const prefix = String(formatted).slice(0, formattedMatches[0].index).replace(/\s+/g, '');
    let result = prefix;
    formattedMatches.forEach((match, index) => {
      const sourceWord = originalWords[index];
      const modelWord = match[0];
      const firstLetter = modelWord[0] === modelWord[0].toLocaleUpperCase('ru-RU')
        ? sourceWord[0].toLocaleUpperCase('ru-RU')
        : sourceWord[0];
      const safeWord = `${firstLetter}${sourceWord.slice(1)}`;
      const nextStart = formattedMatches[index + 1]?.index ?? String(formatted).length;
      const separator = String(formatted).slice(match.index + modelWord.length, nextStart);
      result += safeWord + separator;
    });

    return result.trim();
  };

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
  const requestDialogueReply = async (text, history) => {
    const token = await getValidAccessToken();
    const response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        text,
        history,
        mode: 'discuss',
        use_global_context: useContext,
        parent_thought_id: parentThought ? parentThought.id : null,
        system_prompt: 'Веди содержательный диалог. Голосовой ввод может приходить без пунктуации: понимай его по смыслу и никогда не комментируй отсутствие знаков препинания, грамотность или оформление сообщения.'
      })
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Не удалось получить ответ ИИ');
    return data.reply;
  };

  const requestLegacyCompletion = async (text, systemPrompt) => {
    const token = await getValidAccessToken();
    const response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        text,
        mode: 'editor',
        use_global_context: false,
        system_prompt: systemPrompt
      })
    });
    const data = await response.json();
    if (!response.ok || !data.reply) throw new Error(data.error || 'OpenRouter недоступен');
    return data.reply.trim();
  };

  // В Редакторе сообщение только сохраняется в сессии; в Диалоге ИИ отвечает.
  const handleSend = async (textToSend = inputText) => {
    const trimmedText = textToSend.trim();
    if (!trimmedText || isLoading) return;

    const historyBeforeMessage = messages;
    setMessages(prev => [...prev, { sender: 'user', text: trimmedText }]);
    setInputText('');
    setVoiceError('');
    if (mode === 'editor') return;

    setIsLoading(true);
    try {
      const reply = await requestDialogueReply(trimmedText, historyBeforeMessage);
      setMessages(prev => [...prev, { sender: 'ai', text: reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: `Ошибка связи с сервером: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceTranscript = async (rawTranscript) => {
    const originalText = rawTranscript.trim();
    if (!originalText || voiceSubmissionInFlightRef.current || isLoading) return;

    const fingerprint = normalizeWords(originalText).join(' ');
    const now = Date.now();
    if (
      lastVoiceSubmissionRef.current.fingerprint === fingerprint
      && now - lastVoiceSubmissionRef.current.submittedAt < 60_000
    ) return;

    lastVoiceSubmissionRef.current = { fingerprint, submittedAt: now };
    voiceSubmissionInFlightRef.current = true;
    const historyBeforeMessage = messages;
    let userMessageAdded = false;
    setIsFormattingVoice(true);
    setInputText('');
    setVoiceError('');

    try {
      const token = await getValidAccessToken();
      const response = await fetch(`${apiUrl}/api/voice-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: originalText,
          history: historyBeforeMessage,
          mode,
          use_global_context: useContext
        })
      });

      let data;
      if (response.status === 404) {
        const legacyPrompt = mode === 'discuss'
          ? 'Оформи голосовой текст, не меняя слова, и ответь по смыслу. Никогда не комментируй пунктуацию. Верни строго JSON вида {"text":"Тот же текст со знаками препинания","reply":"Ответ пользователю"}.'
          : 'Оформи голосовой текст, не меняя слова. Верни строго JSON вида {"text":"Тот же текст со знаками препинания","reply":null}.';
        const legacyResult = await requestLegacyCompletion(originalText, legacyPrompt);
        try {
          const cleaned = legacyResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
          data = JSON.parse(cleaned);
        } catch {
          data = { text: originalText, reply: mode === 'discuss' ? legacyResult : null };
        }
      } else {
        data = await response.json();
      }

      if (!response.ok && response.status !== 404) {
        throw new Error(data.error || 'Не удалось обработать голосовое сообщение');
      }

      const formattedText = applyPunctuationToOriginalWords(originalText, data.text || originalText);
      setMessages(prev => [...prev, { sender: 'user', text: formattedText }]);
      userMessageAdded = true;
      setIsFormattingVoice(false);

      const reply = String(data.reply || '').trim();
      const isServiceLabel = /^(user\s+)?safety\s+safe[.!]?$/i.test(reply);
      if (mode === 'discuss' && reply && !isServiceLabel) {
        setMessages(prev => [...prev, { sender: 'ai', text: reply }]);
      }
    } catch (error) {
      if (!userMessageAdded) {
        setMessages(prev => [...prev, { sender: 'user', text: originalText }]);
      }
      if (mode === 'discuss') {
        setMessages(prev => [...prev, { sender: 'ai', text: `Ошибка связи с сервером: ${error.message}` }]);
      }
    } finally {
      voiceSubmissionInFlightRef.current = false;
      setIsFormattingVoice(false);
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
        await handleVoiceTranscript(transcript);
      } else if (!transcript) {
        setVoiceError((currentError) => currentError || 'Safari завершил запись без текста. Попробуйте ещё раз или используйте микрофон на клавиатуре iPhone.');
      }
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      speechTranscriptRef.current = transcript;
      setInputText(transcript);

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

  const handleGenerateEntry = async () => {
    if (messages.length === 0 || isGeneratingEntry) return;
    setIsGeneratingEntry(true);

    try {
      const token = await getValidAccessToken();
      const response = await fetch(`${apiUrl}/api/generate-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history: messages, use_global_context: useContext })
      });
      let data;
      const usedLegacyEndpoint = response.status === 404;
      if (usedLegacyEndpoint) {
        const transcript = messages.map((message) => (
          `${message.sender === 'ai' ? 'ИИ' : 'Пользователь'}: ${message.title ? `${message.title}\n` : ''}${message.text}`
        )).join('\n\n');
        const legacyResult = await requestLegacyCompletion(
          transcript,
          'Создай законченную запись личного журнала, сохранив смысл и голос автора. Верни строго JSON вида {"title":"Краткий заголовок","text":"Полный текст записи"}.'
        );
        const cleaned = legacyResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        data = JSON.parse(cleaned);
      } else {
        data = await response.json();
      }
      if ((!response.ok && !usedLegacyEndpoint) || !data.text) throw new Error(data.error || 'Не удалось сформировать запись');

      setEntryDraft({ title: data.title || 'Новая запись', text: data.text });
      setEntryCreatedAt(new Date());
    } catch (error) {
      alert(`Ошибка формирования записи: ${error.message}`);
    } finally {
      setIsGeneratingEntry(false);
    }
  };

  const handleReturnToSession = () => {
    if (!entryDraft?.text.trim()) return;
    setMessages(prev => [...prev, { sender: 'ai', text: entryDraft.text.trim(), title: entryDraft.title.trim() }]);
    setEntryDraft(null);
    setEntryCreatedAt(null);
  };

  const handlePublish = async () => {
    if (!entryDraft?.text.trim() || isPublishing) return;
    
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
      const token = await getValidAccessToken();
      const response = await fetch(`${apiUrl}/api/thoughts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: entryDraft.title.trim(),
          text: entryDraft.text.trim(),
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
      setEntryDraft(null);
      setEntryCreatedAt(null);
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

  if (entryDraft && entryCreatedAt) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-[90vh]">
        <EntryEditor
          title={entryDraft.title}
          text={entryDraft.text}
          createdAt={entryCreatedAt}
          isPublishing={isPublishing}
          onTitleChange={(title) => setEntryDraft((draft) => ({ ...draft, title }))}
          onTextChange={(text) => setEntryDraft((draft) => ({ ...draft, text }))}
          onPublish={handlePublish}
          onReturn={handleReturnToSession}
        />
      </div>
    );
  }

  const canGenerateEntry = messages.some(msg => msg.sender === 'user');
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
                <button onClick={() => setMode('editor')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'editor' ? 'btn-accent !w-auto' : 'glass opacity-60'}`}>Редактор</button>
                <button onClick={() => setMode('discuss')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'discuss' ? 'btn-accent !w-auto' : 'glass opacity-60'}`}>Диалог</button>
                <label className="ml-auto flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={!useContext} onChange={(e) => setUseContext(!e.target.checked)} className="rounded" />
                  Не учитывать контекст Журнала
                </label>
              </div>
              
              {/* Поток вывода сообщений пользователя и ответов ИИ */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`p-4 rounded-2xl max-w-[80%] ${msg.sender === 'user' ? 'ml-auto btn-accent !w-auto text-white' : 'glass'}`}>
                    {msg.title && <h3 className="font-semibold mb-2">{msg.title}</h3>}
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="glass p-4 rounded-2xl max-w-[40%] animate-pulse text-sm text-[var(--text-secondary)]">ИИ анализирует...</div>
                )}
                {isFormattingVoice && (
                  <div className="ml-auto p-3" aria-label="Сообщение отправляется">
                    <span className="block w-5 h-5 rounded-full border-2 border-[var(--glass-border)] border-t-[var(--accent)] animate-spin" />
                  </div>
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
                
                {canGenerateEntry && (
                  <motion.button 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="btn-outline !w-full py-2.5 text-sm font-semibold tracking-wide border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-soft)]" 
                    onClick={handleGenerateEntry}
                    disabled={isGeneratingEntry || isLoading || isFormattingVoice}
                  >
                    {isGeneratingEntry ? 'Формируем запись…' : 'Сформировать запись'}
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
