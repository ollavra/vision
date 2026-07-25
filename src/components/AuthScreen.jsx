// src/components/AuthScreen.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { t, setLocale, getLocale } from '../i18n';

export default function AuthScreen({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const locale = getLocale();
  const toggleLang = () => setLocale(locale === 'ru' ? 'en' : 'ru');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email && password) {
      onSuccess();
    }
  };

  return (
    <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
      <div className="flex justify-end mb-2">
        <button onClick={toggleLang} className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors px-3 py-1 glass rounded-full">
          {locale === 'ru' ? 'EN' : 'RU'}
        </button>
      </div>
      <div className="glass p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="logo-placeholder mb-4">✦</div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('auth.title')}</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">{t('auth.email')}</label>
            <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input" placeholder="you@example.com" required />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">{t('auth.password')}</label>
            <input id="auth-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-accent">{t('auth.signin')}</button>
        </form>
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-[var(--glass-border)]" />
          <span className="text-sm text-[var(--text-secondary)]">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-[var(--glass-border)]" />
        </div>
        <div className="space-y-3">
          <button className="btn-outline">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t('auth.google')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
