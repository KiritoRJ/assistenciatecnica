
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { registerLocale, setDefaultLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale/pt-BR';

registerLocale('pt-BR', ptBR);
setDefaultLocale('pt-BR');

console.log('PWA: Tentando registrar Service Worker...');
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('PWA: Novo conteúdo disponível, por favor atualize.');
  },
  onOfflineReady() {
    console.log('PWA: Aplicativo pronto para uso offline.');
  },
  onRegistered(r) {
    console.log('PWA: Service Worker registrado com sucesso (virtual):', r);
  },
  onRegisterError(error) {
    console.error('PWA: Erro ao registrar Service Worker (virtual):', error);
  }
});

// Fallback manual registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('PWA: Service Worker registrado manualmente com sucesso:', registration);
      })
      .catch((error) => {
        console.error('PWA: Falha no registro manual do Service Worker:', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
