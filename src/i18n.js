// src/i18n.js
const LOCALE_KEY = 'app_lang';
const translations = {
  ru: {
    auth: {
      title: 'Вход',
      email: 'Email',
      password: 'Пароль',
      signin: 'Войти',
      or: 'или',
      google: 'Продолжить с Google',
      apple: 'Продолжить с Apple',
      noAccount: 'Нет аккаунта?',
      signup: 'Зарегистрироваться',
    },
    onboarding: {
      slogan: 'Добро пожаловать. Тебе всегда есть что сказать. [+vision] поможет.',
      editor: 'Редактор',
      discuss: 'Диалог',
      summary: 'Саммари',
    },
  },
  en: {
    auth: {
      title: 'Sign In',
      email: 'Email',
      password: 'Password',
      signin: 'Sign In',
      or: 'or',
      google: 'Continue with Google',
      apple: 'Continue with Apple',
      noAccount: "Don't have an account?",
      signup: 'Sign Up',
    },
    onboarding: {
      slogan: "Welcome. You always have something to say. [+vision] helps.",
      editor: 'Editor',
      discuss: 'Dialogue',
      summary: 'Summary',
    },
  },
};

const detectLocale = () => {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored) return stored;
  const navLang = navigator.language?.slice(0, 2);
  if (navLang === 'ru') return 'ru';
  return 'en';
};

let currentLocale = detectLocale();

export const t = (path) => {
  const keys = path.split('.');
  let node = translations[currentLocale];
  for (const key of keys) {
    node = node?.[key];
    if (node === undefined) return path;
  }
  return node;
};

export const setLocale = (locale) => {
  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
  window.dispatchEvent(new Event('localechange'));
};

export const getLocale = () => currentLocale;
