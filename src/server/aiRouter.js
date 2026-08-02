import { Router } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { createClient } from '@supabase/supabase-js';

// Инициализация роутера Express
const router = Router();

// Auth uses the public key. Data requests receive the user's JWT so RLS remains active.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const createUserClient = (token) => createClient(supabaseUrl, supabaseKey, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false }
});

async function requireUser(req, res, next) {
  const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Не авторизован: отсутствует токен' });

  const token = match[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Неверный или просроченный токен авторизации' });

  req.auth = { user, supabase: createUserClient(token) };
  next();
}

// Настройка хранилища Multer в оперативной памяти (In-Memory) для обработки аудио
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // Ограничение Groq Whisper — 25 Мб
});

/**
 * Вспомогательная функция сопоставления языков для ИИ-транскрибатора
 */
function mapLangForWhisper(lang = 'ru') {
  if (lang === 'en') return 'en';
  return 'ru';
}

/**
 * =================================================================
 * БЛОК АВТОРИЗАЦИИ (Восстановлен для работы AuthScreen)
 * =================================================================
 */

// Регистрация нового аккаунта
router.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    return res.status(201).json({ success: true, session: data.session, user: data.user });
  } catch (error) {
    console.error('Ошибка регистрации:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// Авторизация / Вход в аккаунт
router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    return res.status(200).json({ success: true, session: data.session, user: data.user });
  } catch (error) {
    console.error('Ошибка входа:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// Обновление короткоживущего access token без повторного ввода пароля.
router.post('/api/refresh-session', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Отсутствует токен обновления сессии' });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error || !data.session) throw error || new Error('Не удалось обновить сессию');

    return res.status(200).json({ success: true, session: data.session });
  } catch (error) {
    return res.status(401).json({ error: 'Сессия истекла. Пожалуйста, войдите снова.' });
  }
});


/**
 * =================================================================
 * БЛОК РАБОТЫ С ЖУРНАЛОМ И МЫСЛЯМИ
 * =================================================================
 */

// Сохранение новой мысли / ветки в Журнал
router.post('/api/thoughts', requireUser, async (req, res) => {
  try {
    const { title, text, mode, parent_thought_id } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Текст мысли не может быть пустым' });
    }

    const { data, error } = await req.auth.supabase
      .from('thoughts')
      .insert([
        {
          user_id: req.auth.user.id,
          title: title?.trim() || null,
          text: text.trim(),
          mode: mode || 'editor',
          parent_thought_id: parent_thought_id || null,
          context_locked: true
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, thought: data });
  } catch (error) {
    console.error('Ошибка сервера при публикации мысли:', error.message);
    return res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// Получение персонального списка всех мыслей пользователя для Архива
router.get('/api/thoughts', requireUser, async (req, res) => {
  try {
    const { data, error } = await req.auth.supabase
      .from('thoughts')
      .select('*')
      .eq('user_id', req.auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ thoughts: data });
  } catch (error) {
    console.error('Ошибка сервера при чтении журнала:', error.message);
    return res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});


 /**
 * =================================================================
 * БЛОК ИНТЕГРАЦИИ С ИИ И ГОЛОСОМ (ФИНАЛЬНЫЙ СТАБИЛЬНЫЙ ВАРИАНТ)
 * =================================================================
 */

const openRouterHeaders = {
  'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://kosova.pro',
  'X-Title': '[+vision] Diary'
};

async function callOpenRouter(messages, temperature = 0.3) {
  const models = ['google/gemma-4-31b-it:free', 'openrouter/free'];
  let lastError;

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: JSON.stringify({ model, messages, temperature })
      });
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!response.ok || data.error || !content) {
        throw new Error(data.error?.message || `${model} вернул пустой ответ`);
      }
      return content.trim();
    } catch (error) {
      lastError = error;
      console.warn(`Модель ${model} недоступна:`, error.message);
    }
  }

  throw lastError || new Error('Модели OpenRouter недоступны');
}

const normalizeWords = (text) => (
  String(text).toLocaleLowerCase('ru-RU').match(/[\p{L}\p{N}]+/gu) || []
);

const applyPunctuationToOriginalWords = (original, formatted) => {
  const originalWords = String(original).match(/[\p{L}\p{N}]+/gu) || [];
  const formattedMatches = Array.from(String(formatted).matchAll(/[\p{L}\p{N}]+/gu));
  if (originalWords.length === 0 || originalWords.length !== formattedMatches.length) return original;

  const normalizedOriginal = normalizeWords(original);
  const normalizedFormatted = normalizeWords(formatted);
  const matchingPositions = normalizedOriginal.filter((word, index) => word === normalizedFormatted[index]).length;
  if (matchingPositions / originalWords.length < 0.8) return original;

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

router.post('/api/punctuate', requireUser, async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Текст обязателен' });

    const formatted = await callOpenRouter([
      {
        role: 'system',
        content: 'Расставь знаки препинания, границы предложений, абзацы и регистр букв. Не добавляй, не удаляй, не заменяй и не переставляй слова. Верни только оформленный текст.'
      },
      { role: 'user', content: text }
    ], 0);

    return res.status(200).json({ text: applyPunctuationToOriginalWords(text, formatted) });
  } catch (error) {
    console.error('Ошибка оформления голосового текста:', error.message);
    return res.status(200).json({ text: String(req.body.text || '').trim(), fallback: true });
  }
});

async function getJournalContext(userClient, userId) {
  const { data, error } = await userClient
    .from('thoughts')
    .select('title, text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((thought) => (
    `${thought.title ? `${thought.title}\n` : ''}${thought.text}`
  )).join('\n\n---\n\n');
}

// Интерактивный ИИ-чат с полным контекстом текущей сессии.
router.post('/api/chat', requireUser, async (req, res) => {
  try {
    const { text, history = [], use_global_context = true } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Текст запроса обязателен' });
    }

    let systemPrompt = 'Ты ассистент ИИ-Дневника. Веди содержательный диалог: задавай глубокие вопросы, замечай противоречия и помогай автору развивать мысль. Учитывай всю переданную текущую сессию.';

    if (use_global_context) {
      const journalContext = await getJournalContext(req.auth.supabase, req.auth.user.id);
      if (journalContext) {
        systemPrompt += `\n\nКонтекст ранее опубликованного Журнала пользователя:\n${journalContext}`;
      }
    }

    const sessionMessages = Array.isArray(history) ? history.slice(-100).map((message) => ({
      role: message.sender === 'ai' ? 'assistant' : 'user',
      content: `${message.title ? `${message.title}\n\n` : ''}${String(message.text || '')}`
    })).filter((message) => message.content.trim()) : [];

    const reply = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      ...sessionMessages,
      { role: 'user', content: String(text) }
    ]);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/chat:', error.message);
    return res.status(500).json({ error: `Ошибка ИИ-анализа: ${error.message}` });
  }
});

router.post('/api/generate-entry', requireUser, async (req, res) => {
  try {
    const { history = [], use_global_context = true } = req.body;
    if (!Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'Сессия пуста' });
    }

    let systemPrompt = 'На основе сессии создай законченную запись для личного журнала. Сохрани смысл, позицию и голос автора. Не упоминай процесс обсуждения. Верни строго JSON вида {"title":"Краткий заголовок","text":"Полный текст записи"}.';
    if (use_global_context) {
      const journalContext = await getJournalContext(req.auth.supabase, req.auth.user.id);
      if (journalContext) systemPrompt += `\n\nДля смыслового контекста используй предыдущие записи Журнала:\n${journalContext}`;
    }

    const transcript = history.map((message) => (
      `${message.sender === 'ai' ? 'ИИ' : 'Пользователь'}: ${message.title ? `${message.title}\n` : ''}${String(message.text || '')}`
    )).join('\n\n');
    const raw = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript }
    ], 0.2);

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const entry = JSON.parse(cleaned);
    if (!entry.title?.trim() || !entry.text?.trim()) throw new Error('ИИ вернул неполную запись');

    return res.status(200).json({ title: entry.title.trim(), text: entry.text.trim() });
  } catch (error) {
    console.error('Ошибка формирования записи:', error.message);
    return res.status(500).json({ error: `Не удалось сформировать запись: ${error.message}` });
  }
});
export default router;
