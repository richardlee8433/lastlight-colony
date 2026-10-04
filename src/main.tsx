import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { installAudio } from './audio/audio';
import { installNoScroll } from './ui/noScroll';

installAudio();
installNoScroll();

createRoot(document.getElementById('root')!).render(<App />);
