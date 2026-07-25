// src/components/OnboardingScreen.jsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { t, getLocale } from '../i18n';

function AudioWave({ isActive }) {
  const bars = useRef(Array.from({ length: 5 }, () => ({ height: 12 + Math.random() * 28, delay: Math.random() * 0.3 })));
  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {bars.current.map((bar, i) => (
        <motion.div key={i} className="w-[3px] rounded-full bg-[var(--accent)]" animate={isActive ? { height: [bar.height * 0.4, bar.height, bar.height * 0.3, bar.height * 0.8, bar.height * 0.4], opacity: [0.5, 1, 0.5, 0.8, 0.5] } : { height: 4, opacity: 0.3 }} transition={isActive ? { duration: 1.2 + bar.delay, repeat: Infinity, ease: 'easeInOut', delay: bar.delay } : { duration: 0.3 }} />
      ))}
    </div>
  );
}

const STEPS = [
  { btn: 'editor', textRu: 'Открой Редактор — начни запись мыслей голосом или текстом.', textEn: 'Open Editor — start recording thoughts by voice or text.' },
  { btn: 'discuss', textRu: 'Нажми «Обсудить» — ИИ задаст наводящие вопросы, чтобы раскрыть тему.', textEn: 'Tap «Discuss» — AI will ask guiding questions to explore the topic.' },
  { btn: 'summary', textRu: 'Саммари — сожми дневник в тезисы и найди инсайты за вечер.', textEn: 'Summary — condense your journal into key points and find insights in the evening.' },
  { btn: null, textRu: '', textEn: '' }
];

export default function OnboardingScreen({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [waveActive, setWaveActive] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);
  const locale = getLocale();

  useEffect(() => {
    const isPause = STEPS[stepIndex].btn === null;
    const duration = isPause ? 1500 : 3000;
    
    const timer = setTimeout(() => {
      if (stepIndex === STEPS.length - 1) {
        if (cycleCount >= 1) {
          onComplete(); // Переходим на главный экран после 2 полных циклов демо
        } else {
          setCycleCount(c => c + 1);
          setStepIndex(0);
        }
      } else {
        setStepIndex(prev => prev + 1);
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [stepIndex, cycleCount, onComplete]);

  useEffect(() => {
    setWaveActive(STEPS[stepIndex].btn !== null);
  }, [stepIndex]);

  const currentStep = STEPS[stepIndex];

  return (
    <motion.div className="w-full max-w-lg mx-auto text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      <p className="text-xl sm:text-2xl font-light leading-relaxed mb-8 text-[var(--text-primary)]">{t('onboarding.slogan')}</p>
      <AudioWave isActive={waveActive} />
      <div className="flex justify-center gap-3 mt-8">
        {['editor', 'discuss', 'summary'].map((key) => {
          const isHighlighted = currentStep.btn === key;
          return (
            <button key={key} className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ background: isHighlighted ? 'var(--accent)' : 'var(--glass-bg)', color: isHighlighted ? '#fff' : 'var(--text-primary)', border: isHighlighted ? '1px solid var(--accent)' : '1px solid var(--glass-border)' }}>
              {t(`onboarding.${key}`)}
            </button>
          );
        })}
      </div>
      <div className="mt-8 min-h-[60px] text-[var(--text-secondary)] text-base px-4">
        {locale === 'ru' ? currentStep.textRu : currentStep.textEn}
      </div>
    </motion.div>
  );
}
