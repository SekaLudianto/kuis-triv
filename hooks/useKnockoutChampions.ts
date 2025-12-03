import { useState, useEffect, useCallback } from 'react';
import { KnockoutChampions, ChampionRecord } from '../types';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, increment } from 'firebase/firestore';

export const useKnockoutChampions = () => {
  const [champions, setChampions] = useState<KnockoutChampions>({});

  useEffect(() => {
    const fetchChampions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "knockoutChampions"));
        const fetchedChampions: KnockoutChampions = {};
        querySnapshot.forEach((doc) => {
          fetchedChampions[doc.id] = doc.data() as ChampionRecord;
        });
        setChampions(fetchedChampions);
      } catch (error) {
        console.error("Failed to load knockout champions from Firestore", error);
      }
    };
    fetchChampions();
  }, []);

  const addChampion = useCallback(async (player: { userId: string, nickname: string }) => {
    const championRef = doc(db, "knockoutChampions", player.userId);
    try {
      // Use setDoc with merge to create or update, ensuring nickname is fresh
      await setDoc(championRef, {
          nickname: player.nickname,
          wins: increment(1)
      }, { merge: true });
      
      // Also update local state for immediate feedback
      setChampions(prev => ({
          ...prev,
          [player.userId]: {
              wins: (prev[player.userId]?.wins || 0) + 1,
              nickname: player.nickname,
          }
      }));
    } catch (error) {
      console.error("Failed to save knockout champion to Firestore", error);
    }
  }, []);

  return { champions, addChampion };
};