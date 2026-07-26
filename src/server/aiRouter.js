import { Router } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { createClient } from '@supabase/supabase-js';

// Инициализация роутера Express
const router = Router();

// Инициализация Supabase клиента строго по вашим переменным из Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

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


/**
 * =================================================================
 * БЛОК РАБОТЫ С ЖУРНАЛОМ И МЫСЛЯМИ
 * =================================================================
 */

// Сохранение новой мысли / ветки в Журнал
router.post('/api/thoughts', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Не авторизован: отсутствует токен' });
    }
    
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Неверный или просроченный токен авторизации' });
    }

    const { text, mode, parent_thought_id } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Текст мысли не может быть пустым' });
    }

    const { data, error } = await supabase
      .from('thoughts')
      .insert([
        {
          user_id: user.id,
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
router.get('/api/thoughts', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Доступ запрещен: отсутствует токен' });
    }
    
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Сессия недействительна или устарела' });
    }

    const { data, error } = await supabase
      .from('thoughts')
      .select('*')
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
 * БЛОК ИНТЕГРАЦИИ С ИИ И ГОЛОСОМ
 * =================================================================
 */

// Интерактивный ИИ-чат (Инкубация и обсуждение идей)
router.post('/api/chat', async (req, res) => {
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

    const openRouterResponse = await fetch('https://openrouter.ai', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kosova.pro',
        'X-Title': '[+vision] Diary'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3
      })
    });

    const aiData = await openRouterResponse.json();
    if (!openRouterResponse.ok || aiData.error) {
      throw new Error(aiData.error?.message || 'Ошибка генерации текста через OpenRouter');
    }

    const reply = aiData.choices[0]?.message?.content;
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/chat:', error.message);
    return res.status(500).json({ error: `Ошибка ИИ-анализа: ${error.message}` });
  }
});

// Голосовое распознавание речи (STT через OpenRouter Whisper)
router.post('/api/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не найден в теле запроса' });
    }

    const lang = req.body.lang || 'ru';
    const whisperLang = mapLangForWhisper(lang);

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: 'voice.webm',
      contentType: 'audio/webm'
    });
    formData.append('model', 'openai/whisper-large-v3');
    formData.append('language', whisperLang);
    formData.append('response_format', 'json');

    const openRouterResponse = await fetch('https://openrouter.ai', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const sttData = await openRouterResponse.json();
    if (!openRouterResponse.ok || sttData.error) {
      throw new Error(sttData.error?.message || 'Ошибка транскрибации на стороне OpenRouter');
    }

    return res.status(200).json({ text: sttData.text });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/stt:', error.message);
    return res.status(500).json({ error: `Ошибка распознавания голоса: ${error.message}` });
  }
});

export default router;

