import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { installAudio } from './audio/audio';

installAudio();

createRoot(document.getElementById('root')!).render(<App />);
