import express from 'express';
import cors from 'cors';
import aiRouter from './aiRouter.js';

const app = express();
const PORT = process.env.PORT || 10000;

// Настройка CORS, чтобы ваш фронтенд с Vercel мог общаться с бэкендом
app.use(cors({
  origin: '*', // На этапе MVP разрешаем все запросы, чтобы не было блокировок
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Обязательные мидлвары для парсинга входящего JSON-тела запросов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Базовый роут проверки жизнеспособности сервера (Health Check)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: '[+vision] API Server is running live' });
});

// Подключаем ваш рабочий aiRouter.js ко всем путям бэкенда
app.use(aiRouter);

// Запуск прослушивания порта для Render.com
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер [+vision] успешно запущен на порту ${PORT}`);
});
