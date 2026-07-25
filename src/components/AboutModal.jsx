// src/components/AboutModal.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { getLocale } from '../i18n';

function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-[var(--glass-border)] py-3">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
        <span>{title}</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed space-y-2">{children}</div>}
    </div>
  );
}

export default function AboutModal({ onClose }) {
  const isRu = getLocale() === 'ru';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div className="w-full max-w-lg glass p-6 sm:p-8" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{isRu ? 'О сервисе & Конфиденциальность' : 'About & Privacy'}</h2>
          <button onClick={onClose} className="text-xl opacity-60 hover:opacity-100">✕</button>
        </div>
        <div className="space-y-1">
          <Accordion title={isRu ? 'База данных' : 'Database Security'}>
            <p>{isRu ? 'Ваши записи защищены технологией Row Level Security (RLS) в облаке Supabase. Ни бэкенд приложения, ни сторонние лица не имеют доступа к вашему дневнику.' : 'Your notes are protected by Row Level Security (RLS) in the Supabase cloud. Neither the app backend nor third parties can access your journal.'}</p>
          </Accordion>
          <Accordion title={isRu ? 'Обработка голоса' : 'Voice Processing'}>
            <p>{isRu ? 'Аудиозаписи обрабатываются исключительно в оперативной памяти сервера (In-Memory) для распознавания речи и удаляются мгновенно после генерации текста. Мы не сохраняем ваши голосовые файлы на дисках.' : 'Audio records are processed strictly in the server volatile memory (In-Memory) for speech-to-text and are deleted instantly after text generation.'}</p>
          </Accordion>
          <Accordion title={isRu ? 'Передача данных' : 'Data Transfer'}>
            <p>{isRu ? 'Текст передается по защищенным каналам SSL/TLS в API агрегатора OpenRouter исключительно для редактуры и анализа в рамках вашей сессии. Данные не используются для обучения публичных моделей.' : 'Text is transmitted via secure SSL/TLS channels to OpenRouter API solely for editing and analysis within your session. Data is not used to train public models.'}</p>
          </Accordion>
          <Accordion title={isRu ? 'Согласие' : 'Consent'}>
            <p>{isRu ? 'Регистрируясь в сервисе, вы соглашаетесь с автоматической обработкой введенных текстовых и голосовых данных для обеспечения работы функций ИИ-ассистента.' : 'By signing up, you agree to the automatic processing of your text and voice data to enable the AI assistant features.'}</p>
          </Accordion>
        </div>
      </motion.div>
    </div>
  );
}
