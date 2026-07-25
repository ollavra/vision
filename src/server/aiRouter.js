/* ================================================================
 1. ЭНДПОИНТ РЕГИСТРАЦИИ С СОЗДАНИЕМ ПРОФИЛЯ (/api/signup)
 ================================================================ */
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  try {
    // 1. Создаем пользователя в системе аутентификации Supabase
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    // 2. Если пользователь создался, привязываем к нему пустой профиль в нашей таблице thoughts
    if (data?.user) {
      const { error: dbError } = await supabase
        .from('thoughts')
        .insert([
          { 
            user_id: data.user.id, 
            text: 'Журнал успешно создан и готов к работе.', 
            mode: 'system' 
          }
        ]);
      if (dbError) console.error('Ошибка создания стартовой записи в БД:', dbError.message);
    }

    res.json({ success: true, session: data.session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
