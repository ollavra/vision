import { motion } from 'framer-motion';

export default function EntryEditor({
  title,
  text,
  createdAt,
  isPublishing,
  onTitleChange,
  onTextChange,
  onPublish,
  onReturn
}) {
  const formattedDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(createdAt);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-6 sm:p-10 min-h-[70vh] flex flex-col gap-6"
    >
      <header className="border-b border-[var(--glass-border)] pb-4">
        <p className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">Запись в Журнал</p>
        <p className="text-sm text-[var(--text-secondary)]">{formattedDate}</p>
      </header>

      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        className="glass-input text-2xl font-semibold"
        placeholder="Название записи"
        aria-label="Название записи"
      />

      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        className="glass-input flex-1 min-h-[320px] resize-y leading-relaxed"
        placeholder="Текст записи"
        aria-label="Текст записи"
      />

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button type="button" onClick={onReturn} className="btn-outline !w-auto px-5 py-3" disabled={isPublishing}>
          Вернуться к сессии
        </button>
        <button type="button" onClick={onPublish} className="btn-accent !w-auto px-5 py-3" disabled={isPublishing || !text.trim()}>
          {isPublishing ? 'Сохраняем…' : 'Сохранить в Журнал'}
        </button>
      </div>
    </motion.section>
  );
}
