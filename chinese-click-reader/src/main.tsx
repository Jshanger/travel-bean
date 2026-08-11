import { StrictMode } from 'react'; import { createRoot } from 'react-dom/client'; import App from './App'; import { SpeechSettingsProvider } from './hooks/useSpeechSettings'; import './styles.css'; import './readerEnhancements.css';
createRoot(document.getElementById('root')!).render(<StrictMode><SpeechSettingsProvider><App/></SpeechSettingsProvider></StrictMode>);
