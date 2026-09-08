import { createRoot } from 'react-dom/client';
import JourneyGame from './components/game/journey';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(<JourneyGame />);
