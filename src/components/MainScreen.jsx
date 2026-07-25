// src/components/MainScreen.jsx
import { useState } from 'react';
import AboutModal from './AboutModal';

export default function MainScreen() {
  const [mode, setMode] = useState('editor'); // 'editor' | 'discuss'
  const [useContext, setUseContext] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    setMessages(prev => [...prev, { sender: 'user', text: inputText }]);
    setInputText('');
    
    // Симуляция ответа ИИ через наш бэкенд URL
    setTimeout(() => {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Мысль зафиксирована в облачном журнале.' }]);
    }, 1000);
  };

  const isContextDisabled = messages.length > 0;

  return (
    <div className="w-full max-w-2xl glass p-6 sm:p-8 flex flex-col h-[80vh]">
      <div className="flex justify-between items-center mb-6 border-b border-[var(--glass-border)] pb-4">
        <span className="text-xl font-bold tracking-tight text-[var(--accent)]">[+vision]</span>
        <button onClick={() => setIsAboutOpen(true)} className="text-sm px-4 py-1.5 glass rounded-full hover:text-[var(--accent)] transition-colors">About</button>
      </div>

      <div className="flex gap-4 mb-4">
        <button onClick={() => !isContextDisabled && setMode('editor')} disabled={isContextDisabled} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'editor' ? 'btn-accent !w-auto' : 'glass opacity-60'}`}>Редактор</button>
        <button onClick={() => !isContextDisabled && setMode('discuss')} disabled={isContextDisabled} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'discuss' ? 'btn-accent !w-auto' : 'glass opacity-60'}`}>Обсудить</button>
        <label className={`ml-auto flex items-center gap-2 text-sm text-[var(--text-secondary)] ${isContextDisabled ? 'opacity-40' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={useContext} disabled={isContextDisabled} onChange={(e) => setUseContext(e.target.checked)} />
          Учитывать контекст
        </label>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={`p-4 rounded-2xl max-w-[80%] ${msg.sender === 'user' ? 'ml-auto btn-accent !w-auto text-white' : 'glass'}`}>{msg.text}</div>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} className="glass-input flex-1" placeholder="Запишите вашу мысль..." />
        <button onClick={handleSend} className="btn-accent !w-auto px-6">➔</button>
      </div>
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
    </div>
  );
}
