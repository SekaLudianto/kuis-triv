import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GamepadIcon, BombIcon, CalculatorIcon } from './IconComponents';
import { DEFAULT_MAX_WINNERS_PER_ROUND } from '../constants';
import { GameStyle, KnockoutCategory, ClassicCategorySelection } from '../types';

interface ModeSelectionScreenProps {
  onStartClassic: (maxWinners: number, category: ClassicCategorySelection) => void;
  onStartKnockout: (category: KnockoutCategory) => void;
  onShowLeaderboard: () => void;
}

const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({ onStartClassic, onStartKnockout, onShowLeaderboard }) => {
  const [maxWinners, setMaxWinners] = useState(() => {
    const saved = localStorage.getItem('tiktok-quiz-maxwinners');
    return saved ? parseInt(saved, 10) : DEFAULT_MAX_WINNERS_PER_ROUND;
  });
  const [gameStyle, setGameStyle] = useState<GameStyle>(GameStyle.Classic);
  const [classicCategory, setClassicCategory] = useState<ClassicCategorySelection>('Random');

  useEffect(() => {
    localStorage.setItem('tiktok-quiz-maxwinners', String(maxWinners));
  }, [maxWinners]);

  const handleMaxWinnersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 1) {
      setMaxWinners(value);
    } else if (e.target.value === '') {
      setMaxWinners(1);
    }
  };

  const handleStartGame = (category?: KnockoutCategory) => {
    if (gameStyle === GameStyle.Classic) {
      onStartClassic(maxWinners, classicCategory);
    } else if (category) {
      onStartKnockout(category);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameStyle === GameStyle.Classic) {
        handleStartGame();
    }
  };
  
  const classicCategories: { id: ClassicCategorySelection, name: string }[] = [
      { id: 'Random', name: 'Random Campuran' },
      { id: 'GuessTheCountry', name: 'Tebak Negara' },
      { id: 'Trivia', name: 'Trivia Umum' },
      { id: 'GuessTheCity', name: 'Tebak Kota' },
      { id: 'ZonaBola', name: 'Zona Bola' },
      { id: 'GuessTheFruit', name: 'Tebak Buah' },
      { id: 'GuessTheAnimal', name: 'Tebak Hewan' },
      { id: 'KpopTrivia', name: 'Zona KPOP' },
  ];

  const knockoutCategories: { id: KnockoutCategory, name: string, icon?: React.ElementType, color?: string }[] = [
    { id: 'GuessTheCountry', name: 'Tebak Negara', color: 'bg-blue-500' },
    { id: 'Trivia', name: 'Trivia Umum', color: 'bg-indigo-500' },
    { id: 'ZonaBola', name: 'Zona Bola', color: 'bg-green-600' },
    { id: 'GuessTheFruit', name: 'Tebak Buah', color: 'bg-orange-500' },
    { id: 'GuessTheAnimal', name: 'Tebak Hewan', color: 'bg-teal-600' },
    { id: 'KpopTrivia', name: 'Zona KPOP', color: 'bg-pink-500' },
    { id: 'Math', name: 'Matematika 123', icon: CalculatorIcon, color: 'bg-purple-600' },
    { id: 'Minesweeper', name: 'Minesweeper', icon: BombIcon, color: 'bg-slate-700' },
  ];

  return (
    <div className="flex flex-col h-full p-4 bg-white dark:bg-gray-800 rounded-3xl transition-colors duration-300">
      <div className="flex-grow flex flex-col items-center justify-center text-center">
        <motion.div
          animate={{ rotate: [0, 5, -5, 5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <GamepadIcon className="w-20 h-20 text-sky-400" />
        </motion.div>
        <h1 className="text-3xl font-bold mt-4 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-teal-500">
          Pilih Mode Permainan
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Koneksi berhasil! Siap untuk bermain?</p>

        <div className="w-full max-w-sm mt-6">
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-sky-50 dark:bg-gray-700 rounded-xl">
              <button 
                type="button" 
                onClick={() => setGameStyle(GameStyle.Classic)} 
                className={`px-4 py-2.5 font-bold rounded-lg transition-all text-sm ${gameStyle === GameStyle.Classic ? 'bg-white dark:bg-gray-600 text-sky-600 dark:text-sky-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                  Klasik (Ramai)
              </button>
               <button 
                type="button" 
                onClick={() => setGameStyle(GameStyle.Knockout)} 
                className={`px-4 py-2.5 font-bold rounded-lg transition-all text-sm ${gameStyle === GameStyle.Knockout ? 'bg-white dark:bg-gray-600 text-sky-600 dark:text-sky-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                  Knockout (1vs1)
              </button>
          </div>

          <AnimatePresence mode="wait">
          {gameStyle === GameStyle.Classic ? (
            <motion.form
                key="classic"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
            >
                <div>
                    <label htmlFor="classicCategory" className="block text-sm text-left text-gray-500 dark:text-gray-400 mb-1 font-medium">Pilih Kategori Soal</label>
                    <select
                        id="classicCategory"
                        value={classicCategory}
                        onChange={(e) => setClassicCategory(e.target.value as ClassicCategorySelection)}
                        className="w-full px-4 py-3 bg-sky-50 border-2 border-sky-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white font-medium"
                    >
                        {classicCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="maxWinners" className="block text-sm text-left text-gray-500 dark:text-gray-400 mb-1 font-medium">Jumlah Pemenang per Ronde</label>
                    <input
                        type="number"
                        id="maxWinners"
                        value={maxWinners}
                        onChange={handleMaxWinnersChange}
                        min="1"
                        max="50"
                        className="w-full px-4 py-3 bg-sky-50 border-2 border-sky-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-center text-lg"
                    />
                </div>
                
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="w-full mt-2 px-4 py-3 bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/30 hover:bg-sky-600 transition-all text-lg"
                >
                    Mulai Game Klasik
                </motion.button>
            </motion.form>
          ) : (
            <motion.div
                key="knockout"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1"
            >
                {knockoutCategories.map((cat) => (
                    <motion.button
                        key={cat.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStartGame(cat.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-md text-white transition-all min-h-[100px] ${cat.color || 'bg-sky-500'}`}
                    >
                        {cat.icon ? <cat.icon className="w-8 h-8 mb-2" /> : <GamepadIcon className="w-8 h-8 mb-2 opacity-50" />}
                        <span className="font-bold text-sm leading-tight">{cat.name}</span>
                    </motion.button>
                ))}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
       <div className="mt-4 text-center shrink-0">
          <button 
            onClick={onShowLeaderboard}
            className="text-sm text-sky-500 dark:text-sky-400 font-semibold hover:underline"
          >
            Lihat Peringkat Global
          </button>
      </div>
    </div>
  );
};

export default ModeSelectionScreen;