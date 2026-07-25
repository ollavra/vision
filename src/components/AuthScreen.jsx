import { useState } from 'react';
import { motion } from 'framer-motion';

export default function AuthScreen({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lang, setLang] = useState('ru');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const translations = {
    ru: {
      title: '[+vision]',
      emailLabel: 'Электронная почта',
      emailPlaceholder: 'имя@example.com',
      passwordLabel: 'Пароль',
      passwordPlaceholder: '••••••••',
      buttonSignIn: 'Войти в журнал',
      buttonSignUp: 'Создать аккаунт',
      or: 'или',
      googleIn: 'Войти через Google',
      googleUp: 'Зарегистрироваться через Google',
      appleIn: 'Войти через Apple',
      appleUp: 'Зарегистрироваться через Apple',
      noAccount: 'Нет аккаунта?',
      hasAccount: 'Уже есть аккаунт?',
      linkSignUp: 'Создать аккаунт',
      linkSignIn: 'Войти',
      loading: 'Подождите...'
    },
    en: {
      title: '[+vision]',
      emailLabel: 'Email Address',
      emailPlaceholder: 'name@example.com',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      buttonSignIn: 'Sign In to Journal',
      buttonSignUp: 'Sign Up',
      or: 'or',
      googleIn: 'Sign In with Google',
      googleUp: 'Sign Up with Google',
      appleIn: 'Sign In with Apple',
      appleUp: 'Sign Up with Apple',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      linkSignUp: 'Sign Up',
      linkSignIn: 'Sign In',
      loading: 'Loading...'
    }
  };

  const t = translations[lang];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const apiUrl = import.meta.env.NEXT_PUBLIC_API_URL || '';
      const endpoint = isSignUp ? '/api/signup' : '/api/login';
      
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Ошибка аутентификации');
      }

      if (data.session) {
        localStorage.setItem('user_session', JSON.stringify(data.session));
      }
      
      onSuccess();
    } catch (err) {
      setErrorMsg(err.message === 'Failed to fetch' ? 'Нет связи с ИИ-сервером' : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
      <div className="flex justify-end mb-2">
        <button 
          onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')} 
          className="text-sm font-medium px-3 py-1 glass rounded-full text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
        >
          {lang === 'ru' ? 'EN' : 'RU'}
        </button>
      </div>

      <div className="glass p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="logo-placeholder mb-4">✦</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{t.title}</h1>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">{t.emailLabel}</label>
            <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input" placeholder={t.emailPlaceholder} required disabled={isLoading} />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">{t.passwordLabel}</label>
            <input id="auth-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input" placeholder={t.passwordPlaceholder} required disabled={isLoading} />
          </div>
          <button type="submit" className="btn-accent" disabled={isLoading}>
            {isLoading ? t.loading : (isSignUp ? t.buttonSignUp : t.buttonSignIn)}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-[var(--glass-border)]" />
          <span className="text-sm text-[var(--text-secondary)]">{t.or}</span>
          <div className="h-px flex-1 bg-[var(--glass-border)]" />
        </div>

        {/* Кнопки соцсетей - ВОТ ЗДЕСЬ ОБЕ НА МЕСТЕ */}
        <div className="space-y-3">
          <button type="button" className="btn-outline" disabled={isLoading}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {isSignUp ? t.googleUp : t.googleIn}
          </button>
          
          <button type="button" className="btn-outline" disabled={isLoading}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/></svg>
            {isSignUp ? t.appleUp : t.appleIn}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          {isSignUp ? t.hasAccount : t.noAccount}{' '}
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-[var(--accent)] font-semibold hover:underline"
            disabled={isLoading}
          >
            {isSignUp ? t.linkSignIn : t.linkSignUp}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
