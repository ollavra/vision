import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-client';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Инициализация Supabase для работы с журналом и контекстом
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 1. Голосовой ввод (Аудио в текст с автопунктуацией через Whisper на OpenRouter)
router.post('/stt', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
        const userLanguage = req.body.language || 'ru';

        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: 'audio.webm', contentType: req.file.mimetype });
        formData.append('model', 'openai/whisper-large-v3');
        formData.append('language', userLanguage);

        const response = await fetch('https://openrouter.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        res.json({ text: data.text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Режимы: Обсудить (Диалог) / Редактор (Монолог) через Gemini 1.5 Flash на OpenRouter
router.post('/chat', async (req, res) => {
    try {
        const { text, mode, parent_thought_id, use_global_context, system_prompt } = req.body;
        let aiContext = "";

        // Если включен чекбокс глобального контекста, вытаскиваем старые записи из Supabase
        if (use_global_context) {
            const { data: pastThoughts } = await supabase
                .from('thoughts')
                .select('text, summary')
                .limit(10);
            if (pastThoughts) {
                aiContext = "Контекст прошлых записей дневника автора:\n" + 
                            pastThoughts.map(t => t.summary || t.text).join('\n---\n') + "\n\n";
            }
        }

        const messages = [
            { role: 'system', content: system_prompt || 'Ты ассистент ИИ-Дневника в стиле строгого делового научпопа.' },
            { role: 'user', content: `${aiContext}Текущее сообщение пользователя: ${text}\nРежим работы: ${mode === 'editor' ? 'Редактирование текста и исправление ошибок речи' : 'Живой диалог'}` }
        ];

        const response = await fetch('https://openrouter.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-1.5-flash',
                messages: messages
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        res.json({ reply: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Создание Саммари главы/поста через Gemini 1.5 Flash на OpenRouter
router.post('/summary', async (req, res) => {
    try {
        const { chat_history } = req.body;

        const response = await fetch('https://openrouter.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-1.5-flash',
                messages: [
                    { role: 'system', content: 'Создай структурированное финальное саммари сессии для публикации в книге/дневнике. Стиль: строгий деловой научпоп без воды. Акцентируй внимание на финальном мнении автора.' },
                    { role: 'user', content: `История текущей сессии чата:\n${JSON.stringify(chat_history)}` }
                ]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        res.json({ summary: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
