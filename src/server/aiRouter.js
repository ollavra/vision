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
    const { text, mode, parent_thought_id } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Текст мысли не может быть пустым' });
    }

    const { data, error } = await req.auth.supabase
      .from('thoughts')
      .insert([
        {
          user_id: req.auth.user.id,
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

// Интерактивный ИИ-чат (С каскадным переключением на бесплатный резерв)
router.post('/api/chat', requireUser, async (req, res) => {
  try {
    const { text, mode, system_prompt, use_global_context, parent_thought_id } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Текст запроса обязателен' });
    }

    let finalSystemPrompt = system_prompt || 'Ты ассистент ИИ-Дневника в стиле строгого делового научпопа.';
    
    if (mode === 'discuss') {
      finalSystemPrompt += ' Твоя цель — не соглашаться, а задавать глубокие наводящие вопросы, искать логические противоречия и помогать автору развернуть мысль дальше.';
    } else {
      finalSystemPrompt += ' Твоя цель — аккуратно отредактировать текст, структурировать хаотичный поток мыслей, выделить тезисы, не меняя ключевой смысл.';
    }

    let aiData;
    let openRouterResponse;

    try {
      // ПОПЫТКА 1: Стучимся к лучшей бесплатной модели из вашего списка
      console.log('Попытка вызова основной бесплатной модели: google/gemma-4-31b-it:free');
      openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kosova.pro',
          'X-Title': '[+vision] Diary'
        },
        body: JSON.stringify({
          model: 'google/gemma-4-31b-it:free',
          messages: [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: String(text) }
          ],
          temperature: 0.3
        })
      });

      aiData = await openRouterResponse.json();

      if (!openRouterResponse.ok || aiData.error || !aiData.choices) {
        throw new Error(aiData.error?.message || 'Основная модель недоступна');
      }

    } catch (primaryModelError) {
      // КАСКАДНЫЙ ПЕРЕХОД: Если попытка 1 упала, активируется фиолетовый Free Models Router
      console.warn('⚠️ Основная модель выдала ошибку. Переключаюсь на Free Models Router:', primaryModelError.message);

      openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kosova.pro',
          'X-Title': '[+vision] Diary'
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: String(text) }
          ],
          temperature: 0.4
        })
      });

      aiData = await openRouterResponse.json();

      if (!openRouterResponse.ok || aiData.error) {
        console.error('Ошибка даже на резервном бесплатном роутере:', aiData.error);
        throw new Error(aiData.error?.message || 'Ошибка генерации на резервном шлюзе OpenRouter');
      }
    }

    // Извлекаем ответ с обязательным индексом, чтобы Node.js не выдал синтаксическую ошибку
    const reply = aiData.choices?.[0]?.message?.content || aiData.choices?.message?.content;
    if (!reply) {
      throw new Error('ИИ вернул пустой ответ');
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/chat:', error.message);
    return res.status(500).json({ error: `Ошибка ИИ-анализа: ${error.message}` });
  }
});
export default router;


