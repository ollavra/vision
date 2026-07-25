// src/App.jsx
import { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import MainScreen from './components/MainScreen';
import { getLocale } from './i18n';

function useLocale() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener('localechange', handler);
    return () => window.removeEventListener('localechange', handler);
  }, []);
  return getLocale();
}

export default function App() {
  const [screen, setScreen] = useState('auth'); // 'auth' | 'onboarding' | 'main'
  useLocale();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      {screen === 'auth' && <AuthScreen onSuccess={() => setScreen('onboarding')} />}
      {screen === 'onboarding' && <OnboardingScreen onComplete={() => setScreen('main')} />}
      {screen === 'main' && <MainScreen />}
    </div>
  );
}
