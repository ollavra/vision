import { useState } from 'react';  
import { motion } from 'framer-motion';  

export default function AuthScreen({ onSuccess }) {  
  const [name, setName] = useState('');  
  const [email, setEmail] = useState('');  
  const [password, setPassword] = useState('');  
  const [lang, setLang] = useState('ru');  
  const [isSignUp, setIsSignUp] = useState(false);  
  const [errorMsg, setErrorMsg] = useState('');  
  const [isLoading, setIsLoading] = useState(false);  

  const translations = {  
    ru: {  
      title: '[+vision]',  
      nameLabel: 'Имя',  
      namePlaceholder: 'Как к вам обращаться?',  
      emailLabel: 'Электронная почта',  
      emailPlaceholder: 'user@example.com',  
      passwordLabel: 'Пароль',  
      passwordPlaceholder: 'Не менее 6 символов',  
      buttonSignIn: 'Войти',  
      buttonSignUp: 'Создать аккаунт',  
      or: 'или',  
      googleIn: 'Войти через Google',  
      googleUp: 'Зарегистрироваться через Google',  
      appleIn: 'Войти через Apple',  
      appleUp: 'Зарегистрироваться через Apple',  
      noAccount: 'Нет аккаунта?',  
      hasAccount: 'Уже есть аккаунт?',  
      linkSignUp: 'Создать аккаунт',  
      linkSignIn: 'Войти',  
      loading: 'Подождите...',  
      errEmptyFields: 'Пожалуйста, заполните все поля',  
      errShortPassword: 'Пароль должен быть не менее 6 символов',  
      errInvalidEmail: 'Пожалуйста, введите корректный email'  
    },  
    en: {  
      title: '[+vision]',  
      nameLabel: 'Name',  
      namePlaceholder: 'What is your name?',  
      emailLabel: 'Email Address',  
      emailPlaceholder: 'name@example.com',  
      passwordLabel: 'Password',  
      passwordPlaceholder: 'At least 6 characters',  
      buttonSignIn: 'Sign In',  
      buttonSignUp: 'Sign Up',  
      or: 'or',  
      googleIn: 'Sign In with Google',  
      googleUp: 'Sign Up with Google',  
      appleIn: 'Sign In with Apple',  
      appleUp: 'Sign Up with Apple',  
      noAccount: "Don't have an account?",  
      hasAccount: 'Already have an account?',  
      linkSignUp: 'Sign Up',  
      linkSignIn: 'Sign In',  
      loading: 'Loading...',  
      errEmptyFields: 'Please fill in all fields',  
      errShortPassword: 'Password must be at least 6 characters long',  
      errInvalidEmail: 'Please enter a valid email address'  
    }  
  };  

  const t = translations[lang];  

  const validateEmail = (input) => {  
    return input.includes('@') && input.includes('.');  
  };  

  const handleSubmit = async (e) => {  
    e.preventDefault();  
    if (isLoading) return;  

    if (isSignUp && !name.trim()) {  
      setErrorMsg(t.errEmptyFields);  
      return;  
    }  

    if (!email.trim() || !password.trim()) {  
      setErrorMsg(t.errEmptyFields);  
      return;  
    }  

    if (!validateEmail(email)) {  
      setErrorMsg(t.errInvalidEmail);  
      return;  
    }  

    if (password.length < 6) {  
      setErrorMsg(t.errShortPassword);  
      return;  
    }  

    setIsLoading(true);  
    setErrorMsg('');  

    try {  
      const apiUrl = 'https://onrender.com';  
      const endpoint = isSignUp ? '/api/signup' : '/api/login';  
