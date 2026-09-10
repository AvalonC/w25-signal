import { createRoot } from 'react-dom/client';
import JourneyGame from './components/game/journey';
import './app/globals.css';
import './app/flow.css';
import './app/atmosphere.css';
import './app/bracelet.css';
import './app/motion.css';

createRoot(document.getElementById('root')!).render(<JourneyGame />);
