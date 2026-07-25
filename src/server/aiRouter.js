import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import multer from 'multer';
import FormData from 'form-data';

const router = express.Router();
const app = express();

// Настройка Supabase из переменных окружения Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Настройка хранилища для аудиофайлов (в оперативной памяти - In-Memory)
const upload = multer({ storage: multer.memoryStorage() });

/* ================================================================
 1. ЭНДПОИНТ РЕГИСТРАЦИИ (/api/signup)
 ================================================================ */
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
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
 3. ЭНДПОИНТ ИИ-ЧАТА (/api/chat)
 ================================================================ */
router.post('/chat', async (req, res) => {
  const { text, mode, use_global_context, system_prompt } = req.body;

  try {
    const openRouterUrl = 'https://openrouter.ai';
    const response = await fetch(openRouterUrl, {
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
    
    res.json({ reply: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ================================================================
 ЗАПУСК СЕРВЕРА EXPRESS
 ================================================================ */
app.use(express.json());

// Разрешаем CORS-запросы с фронтенда Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api', router);
app.listen(process.env.PORT || 3000, () => console.log('Server is running on port 3000'));

export default router;
