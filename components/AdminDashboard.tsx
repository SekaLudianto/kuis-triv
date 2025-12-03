import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { LeaderboardEntry } from '../types';

interface LiveGameState {
  status?: string;
  connectedUsername?: string;
  gameState?: string;
  round?: number;
  currentAnswer?: string;
  gameMode?: string;
  knockoutCategory?: string;
}

interface AdminDashboardProps {
  onClose?: () => void; // Made optional
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [liveGameState, setLiveGameState] = useState<LiveGameState | null>(null);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const unsubGameSession = onSnapshot(doc(db, "gameSessions", "live"), (doc) => {
      setLiveGameState(doc.data() as LiveGameState);
    });

    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(20));
    const unsubLeaderboard = onSnapshot(q, (querySnapshot) => {
      const leaderboardData: LeaderboardEntry[] = [];
      querySnapshot.forEach((doc) => {
        leaderboardData.push(doc.data() as LeaderboardEntry);
      });
      setLiveLeaderboard(leaderboardData);
    });

    return () => {
      unsubGameSession();
      unsubLeaderboard();
    };
  }, []);

  const renderValue = (value: any) => {
    if (value === undefined || value === null || value === '') {
      return <span className="italic text-gray-500">N/A</span>;
    }
    return <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sky-700 dark:text-sky-300">{String(value)}</span>;
  };
  
  const DashboardContent = (
    <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-2xl h-[90vh] bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-teal-500 shrink-0 mb-4">
          Admin Dashboard (Live)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-y-auto min-h-0">
          {/* Game State Section */}
          <div className="bg-sky-50 dark:bg-gray-900/50 p-3 rounded-lg flex flex-col">
            <h3 className="font-bold mb-2 border-b border-sky-200 dark:border-gray-700 pb-1">Status Permainan</h3>
            <div className="space-y-2 text-sm overflow-y-auto">
              <div className="flex justify-between items-center"><span>Status Server:</span> {renderValue(liveGameState?.status)}</div>
              <div className="flex justify-between items-center"><span>Akun Terhubung:</span> {renderValue(liveGameState?.connectedUsername)}</div>
              <div className="flex justify-between items-center"><span>State Game:</span> {renderValue(liveGameState?.gameState)}</div>
              <div className="flex justify-between items-center"><span>Ronde:</span> {renderValue(liveGameState?.round)}</div>
              <div className="flex justify-between items-center"><span>Mode Game:</span> {renderValue(liveGameState?.gameMode)}</div>
              <div className="flex justify-between items-center"><span>Kategori:</span> {renderValue(liveGameState?.knockoutCategory)}</div>
              <div className="flex justify-between items-start"><span className="shrink-0 mr-2">Jawaban Saat Ini:</span> <span className="text-right">{renderValue(liveGameState?.currentAnswer)}</span></div>
            </div>
          </div>

          {/* Leaderboard Section */}
          <div className="bg-amber-50 dark:bg-gray-900/50 p-3 rounded-lg flex flex-col">
            <h3 className="font-bold mb-2 border-b border-amber-200 dark:border-gray-700 pb-1">Papan Peringkat</h3>
            <div className="flex-grow overflow-y-auto pr-2 space-y-1.5 text-sm">
              {liveLeaderboard.map((player, index) => (
                <div key={player.userId} className="flex items-center gap-2 p-1 rounded bg-white dark:bg-gray-800">
                  <span className="font-bold w-6">{index + 1}.</span>
                  <img src={player.profilePictureUrl || `https://i.pravatar.cc/40?u=${player.userId}`} className="w-6 h-6 rounded-full" alt={player.nickname}/>
                  <span className="flex-1 truncate font-semibold">{player.nickname}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{player.score}</span>
                </div>
              ))}
               {liveLeaderboard.length === 0 && <p className="text-center text-gray-500 pt-10">Memuat papan peringkat...</p>}
            </div>
          </div>
        </div>

        {onClose && (
            <button
                onClick={onClose}
                className="mt-4 w-full px-4 py-2 bg-sky-500 text-white font-bold rounded-lg hover:bg-sky-600 transition-all shrink-0"
            >
                Tutup
            </button>
        )}
      </motion.div>
  );

  // If onClose is provided, render as a modal. Otherwise, render as a standalone page content.
  if (onClose) {
      return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={onClose}
        >
            {DashboardContent}
        </motion.div>
      );
  }

  return DashboardContent; // Render directly without modal overlay
};

export default AdminDashboard;