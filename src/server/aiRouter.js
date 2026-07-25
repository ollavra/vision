import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { createRequire } from 'module';

// Безопасно подключаем CommonJS библиотеки в ESM окружение
const require = createRequire(import.meta.url);
const multer = require('multer');
const FormData = require('form-data');

const router = express.Router();

// Настройка Supabase и хранилища аудио
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const upload = multer({ storage: multer.memoryStorage() });

/* ================================================================
 1. ЭНДПОИНТ РЕГИСТРАЦИИ С СОЗДАНИЕМ ПРОФИЛЯ (/api/signup)
 ================================================================ */
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  try {
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    if (data?.user) {
      const { error: dbError } = await supabase
        .from('thoughts')
        .insert([{ user_id: data.user.id, text: 'Журнал создан.', mode: 'system' }]);
      if (dbError) console.error('Ошибка записи в БД:', dbError.message);
    }
    res.json({ success: true, session: data.session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* ================================================================
 2. ЭНДПОИНТ ВХОДА (/api/login)
 ================================================================ */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({ success: true, session: data.session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* ================================================================
 2.5. ЭНДПОИНТ РАСПОЗНАВАНИЯ РЕЧИ (/api/stt)
 ================================================================ */
router.post('/stt', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Аудиофайл не найден' });
  }
  try {
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'audio.wav',
      contentType: req.file.mimetype || 'audio/wav',
    });
    formData.append('model', 'openai/whisper-large-v3');

    const response = await fetch('https://openrouter.ai', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error?.message || 'Ошибка Whisper');
    res.json({ success: true, text: data.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ================================================================
 3. ЭНДПОИНТ ИИ-ЧАТА (/api/chat)
 ================================================================ */
router.post('/chat', async (req, res) => {
  const { text, mode, use_global_context, system_prompt } = req.body;
  try {
    const response = await fetch('https://openrouter.ai', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vercel.com',
        'X-Title': '[+vision] Diary'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5-8b',
        messages: [
          { role: 'system', content: system_prompt || 'Ты ассистент ИИ-Дневника.' },
          { role: 'user', content: text }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Ошибка OpenRouter');
    res.json({ reply: data.choices.message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ================================================================
 ЗАПУСК СЕРВЕРА EXPRESS И CORS
 ================================================================ */
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api', router);

// Render автоматически передает нужный порт через переменную окружения PORT
app.listen(process.env.PORT || 3000, () => {
  console.log('Сервер [+vision] успешно запущен и слушает запросы');
});

export default router;
