import React, { useReducer, useCallback, useEffect, useRef } from 'react';
import { Country, ChatMessage, LeaderboardEntry, RoundWinner, GameMode, AbcCategory, WordCategory, GameState, GameStyle, KnockoutPlayer, KnockoutBracket, KnockoutMatch, GameActionPayloads, KnockoutCategory, TriviaQuestion, GameAction, City, FootballStadium, LetterObject, MinesweeperCell, MathQuestion, ClassicCategorySelection } from '../types';
import { countries } from '../data/countries';
import { fruits } from '../data/fruits';
import { animals } from '../data/animals';
import { objects } from '../data/objects';
import { professions } from '../data/professions';
import { indonesianCities } from '../data/indonesian_cities';
import { plants } from '../data/plants';
import { footballPlayers } from '../data/football_players';
import { footballClubs } from '../data/football_clubs';
import { footballStadiums } from '../data/football_stadiums';
import { triviaQuestions } from '../data/trivia';
import { kpopTrivia } from '../data/kpop_trivia';
import { cities } from '../data/cities';
import { TOTAL_ROUNDS, ROUND_TIMER_SECONDS, BASE_POINTS, SPEED_BONUS_MULTIPLIER, WINNER_MODAL_TIMEOUT_MS, UNIQUENESS_BONUS_POINTS, KNOCKOUT_TARGET_SCORE, KNOCKOUT_PREPARE_SECONDS, KNOCKOUT_WINNER_VIEW_SECONDS, KNOCKOUT_ROUND_TIMER_SECONDS, ANSWER_REVEAL_DELAY_SECONDS } from '../constants';
import { db } from '../firebase';
import { collection, doc, getDocs, updateDoc, increment, setDoc, query, orderBy, limit } from 'firebase/firestore';


export interface InternalGameState {
  gameState: GameState;
  gameStyle: GameStyle;
  hostUsername: string | null;
  round: number;
  gameMode: GameMode | null;
  currentCountry: Country | null;
  currentLetter: string | null;
  currentCategory: AbcCategory | null;
  currentWord: string | null;
  currentWordCategory: WordCategory | null;
  currentTriviaQuestion: TriviaQuestion | null;
  currentCity: City | null;
  currentStadium: FootballStadium | null;
  usedAnswers: string[];
  scrambledWord: LetterObject[][];
  leaderboard: LeaderboardEntry[];
  sessionLeaderboard: LeaderboardEntry[];
  roundWinners: RoundWinner[];
  isRoundActive: boolean;
  roundTimer: number;
  showWinnerModal: boolean;
  availableAnswersCount: number | null;
  allAnswersFoundInRound: boolean;
  maxWinners: number;
  isPausedByAdmin: boolean;
  countdownValue: number | null;
  chatMessages: ChatMessage[]; // Added for ChatTab
  classicRoundDeck: GameMode[];
  classicCategorySelection: ClassicCategorySelection;

  // Knockout state
  knockoutCategory: KnockoutCategory | null;
  knockoutPlayers: KnockoutPlayer[];
  knockoutBracket: KnockoutBracket | null;
  currentBracketRoundIndex: number | null;
  currentMatchIndex: number | null;
  knockoutMatchPoints: { player1: number; player2: number };
  
  // Minesweeper State
  minesweeperGrid: MinesweeperCell[];

  // Math State
  currentMathQuestion: MathQuestion | null;
}


const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

const scrambleWord = (name:string): LetterObject[][] => {
    const words = name.toUpperCase().split(' ');
    const VOWELS = ['A', 'I', 'U', 'E', 'O'];

    // Find the index of the longest word to add decoys to
    let longestWordIndex = 0;
    let maxLength = 0;
    words.forEach((word, index) => {
        if (word.length > maxLength) {
            maxLength = word.length;
            longestWordIndex = index;
        }
    });

    return words.map((word, wordIndex) => {
        // Create an array of LetterObjects with stable IDs based on original index
        const lettersWithDecoys: LetterObject[] = word.split('').map((char, index) => ({
            id: `w${wordIndex}-i${index}`,
            letter: char,
            isDecoy: false,
        }));

        // Add 3 decoy vowels only to the longest word
        if (wordIndex === longestWordIndex) {
            for (let i = 0; i < 3; i++) {
                const randomVowel = VOWELS[Math.floor(Math.random() * VOWELS.length)];
                lettersWithDecoys.push({
                    id: `w${wordIndex}-d${i}`,
                    letter: randomVowel,
                    isDecoy: true
                });
            }
        }
        
        // Shuffle the combined array
        return shuffleArray(lettersWithDecoys);
    }).map(wordArray => [...wordArray]); // Return a new array of new arrays
};

// --- MATH GENERATOR (HARD MODE) ---
const generateMathQuestion = (): MathQuestion => {
    // 0: Addition (Hundreds), 1: Subtraction (Hundreds), 2: Multiplication (Tens), 
    // 3: Division (Clean), 4: Mixed (Order of Operations)
    const type = Math.floor(Math.random() * 5);
    
    let question = '';
    let answer = 0;

    switch (type) {
        case 0: // Hard Addition
            const a1 = Math.floor(Math.random() * 899) + 100; // 100-999
            const a2 = Math.floor(Math.random() * 899) + 100;
            question = `${a1} + ${a2} = ?`;
            answer = a1 + a2;
            break;
        case 1: // Hard Subtraction
            const s1 = Math.floor(Math.random() * 500) + 500; // 500-1000
            const s2 = Math.floor(Math.random() * 450) + 50;  // 50-500
            question = `${s1} - ${s2} = ?`;
            answer = s1 - s2;
            break;
        case 2: // Hard Multiplication
            // Case A: 2 digit x 1 digit (High numbers) e.g., 87 x 8
            if (Math.random() > 0.5) {
                const m1 = Math.floor(Math.random() * 70) + 20; // 20-90
                const m2 = Math.floor(Math.random() * 7) + 3;   // 3-9
                question = `${m1} x ${m2} = ?`;
                answer = m1 * m2;
            } else {
                // Case B: 2 digit x 2 digit (Teens/Twenties) e.g., 14 x 16
                const m1 = Math.floor(Math.random() * 15) + 11; // 11-25
                const m2 = Math.floor(Math.random() * 15) + 11; 
                question = `${m1} x ${m2} = ?`;
                answer = m1 * m2;
            }
            break;
        case 3: // Division (Integer Result)
            const dAns = Math.floor(Math.random() * 50) + 10; // Result between 10-60
            const dDivisor = Math.floor(Math.random() * 15) + 4; // Divisor between 4-19
            const dividend = dAns * dDivisor;
            question = `${dividend} : ${dDivisor} = ?`;
            answer = dAns;
            break;
        case 4: // Mixed Operations (PEMDAS Trick)
            // A + B x C  or  A - B x C
            const op = Math.random() > 0.5 ? '+' : '-';
            const mx1 = Math.floor(Math.random() * 50) + 20;
            const mx2 = Math.floor(Math.random() * 10) + 3;
            const mx3 = Math.floor(Math.random() * 10) + 3;
            
            question = `${mx1} ${op} ${mx2} x ${mx3} = ?`;
            
            // Multiply first!
            const multRes = mx2 * mx3;
            answer = op === '+' ? mx1 + multRes : mx1 - multRes;
            break;
    }

    return { question, answer };
};


// --- MINESWEEPER LOGIC ---
const ROWS = 5;
const COLS = 5;
const MINES_COUNT = 5;

const generateMinesweeperGrid = (): MinesweeperCell[] => {
    const grid: MinesweeperCell[] = [];
    const colLabels = ['A', 'B', 'C', 'D', 'E'];

    // Initialize cells
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            grid.push({
                id: `${colLabels[c]}${r + 1}`,
                row: r,
                col: c,
                isMine: false,
                isRevealed: false,
                neighborMines: 0
            });
        }
    }

    // Place mines
    let minesPlaced = 0;
    while (minesPlaced < MINES_COUNT) {
        const idx = Math.floor(Math.random() * grid.length);
        if (!grid[idx].isMine) {
            grid[idx].isMine = true;
            minesPlaced++;
        }
    }

    // Calculate neighbors
    for (let i = 0; i < grid.length; i++) {
        const cell = grid[i];
        if (cell.isMine) continue;

        let count = 0;
        for (let r = cell.row - 1; r <= cell.row + 1; r++) {
            for (let c = cell.col - 1; c <= cell.col + 1; c++) {
                if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                    const neighbor = grid.find(g => g.row === r && g.col === c);
                    if (neighbor && neighbor.isMine) count++;
                }
            }
        }
        cell.neighborMines = count;
    }

    return grid;
};


const createInitialState = (): InternalGameState => ({
  gameState: GameState.Setup,
  gameStyle: GameStyle.Classic,
  hostUsername: null,
  round: 0,
  gameMode: null,
  currentCountry: null,
  currentLetter: null,
  currentCategory: null,
  currentWord: null,
  currentWordCategory: null,
  currentTriviaQuestion: null,
  currentCity: null,
  currentStadium: null,
  usedAnswers: [],
  scrambledWord: [],
  leaderboard: [],
  sessionLeaderboard: [],
  roundWinners: [],
  isRoundActive: false,
  roundTimer: ROUND_TIMER_SECONDS,
  showWinnerModal: false,
  availableAnswersCount: null,
  allAnswersFoundInRound: false,
  maxWinners: 5,
  isPausedByAdmin: false,
  countdownValue: null,
  chatMessages: [],
  classicRoundDeck: [],
  classicCategorySelection: 'Random',
  knockoutCategory: null,
  knockoutPlayers: [],
  knockoutBracket: null,
  currentBracketRoundIndex: null,
  currentMatchIndex: null,
  knockoutMatchPoints: { player1: 0, player2: 0 },
  minesweeperGrid: [],
  currentMathQuestion: null,
});

// --- KNOCKOUT HELPERS ---
const generateBracket = (players: KnockoutPlayer[]): KnockoutBracket => {
    const shuffledPlayers = shuffleArray(players);
    const numPlayers = shuffledPlayers.length;
    if (numPlayers < 2) return [];

    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
    const numByes = nextPowerOfTwo - numPlayers;
    const numFirstRoundMatches = (numPlayers - numByes) / 2;

    const bracket: KnockoutBracket = [];
    const firstRound: KnockoutMatch[] = [];
    
    let playerIndex = 0;

    for (let i = 0; i < numFirstRoundMatches; i++) {
        firstRound.push({
            id: `r0-m${i}`,
            player1: shuffledPlayers[playerIndex++],
            player2: shuffledPlayers[playerIndex++],
            winner: null,
            roundIndex: 0,
            matchIndex: i,
        });
    }

    for (let i = 0; i < numByes; i++) {
        const playerWithBye = shuffledPlayers[playerIndex++];
        firstRound.push({
            id: `r0-m${numFirstRoundMatches + i}`,
            player1: playerWithBye,
            player2: null,
            winner: playerWithBye, 
            roundIndex: 0,
            matchIndex: numFirstRoundMatches + i,
        });
    }

    bracket.push(firstRound);

    let currentRoundWinners = numFirstRoundMatches + numByes;
    let roundIndex = 1;
    while (currentRoundWinners > 1) {
        const numMatchesInNextRound = currentRoundWinners / 2;
        const nextRound: KnockoutMatch[] = [];
        for (let i = 0; i < numMatchesInNextRound; i++) {
            nextRound.push({
                id: `r${roundIndex}-m${i}`,
                player1: null,
                player2: null,
                winner: null,
                roundIndex,
                matchIndex: i,
            });
        }
        if(nextRound.length > 0) bracket.push(nextRound);
        currentRoundWinners /= 2;
        roundIndex++;
    }
    
    // Auto-populate winners from BYE matches to the next round
    if (bracket.length > 1) {
        for(let i=0; i < bracket[0].length; i++) {
            const match = bracket[0][i];
            if (match.winner) {
                const nextRoundMatchIndex = Math.floor(i / 2);
                const nextMatch = bracket[1][nextRoundMatchIndex];
                if (nextMatch) {
                    if (!nextMatch.player1) nextMatch.player1 = match.winner;
                    else if (!nextMatch.player2) nextMatch.player2 = match.winner;
                }
            }
        }
    }

    return bracket;
};

const advanceWinnerInBracket = (bracket: KnockoutBracket, winner: KnockoutPlayer, roundIndex: number, matchIndex: number): KnockoutBracket => {
    const newBracket = JSON.parse(JSON.stringify(bracket));
    const nextRoundIndex = roundIndex + 1;
    if (newBracket[nextRoundIndex]) {
        const nextMatchIndex = Math.floor(matchIndex / 2);
        if (newBracket[nextRoundIndex][nextMatchIndex]) {
            const nextMatch = newBracket[nextRoundIndex][nextMatchIndex];
            if (!nextMatch.player1) {
                nextMatch.player1 = winner;
            } else if (!nextMatch.player2) {
                nextMatch.player2 = winner;
            }
        }
    }
    return newBracket;
};

const isTournamentOver = (bracket: KnockoutBracket, roundIndex: number): boolean => {
    if (!bracket || bracket.length === 0) return false;
    // The tournament is over if the current round is the last round
    return roundIndex === bracket.length - 1;
};

const gameReducer = (state: InternalGameState, action: GameAction): InternalGameState => {
  switch (action.type) {
    case 'START_GAME': {
      const initialState = createInitialState();
      const { gameStyle, maxWinners, knockoutCategory, classicCategorySelection, classicRoundDeck, firstRoundData } = action.payload;

      if (gameStyle === GameStyle.Classic && firstRoundData) {
        const scrambled = firstRoundData.country ? scrambleWord(firstRoundData.country.name)
                        : firstRoundData.triviaQuestion ? scrambleWord(firstRoundData.triviaQuestion.answer)
                        : firstRoundData.city ? scrambleWord(firstRoundData.city.name)
                        : firstRoundData.word ? scrambleWord(firstRoundData.word)
                        : firstRoundData.stadium ? scrambleWord(firstRoundData.stadium.name)
                        : [];

        return {
          ...initialState,
          hostUsername: state.hostUsername,
          leaderboard: state.leaderboard, // Preserve global leaderboard across sessions
          gameStyle: gameStyle,
          maxWinners: maxWinners,
          classicRoundDeck: classicRoundDeck || [],
          classicCategorySelection: classicCategorySelection || 'Random',
          gameState: GameState.Playing,
          round: 1,
          gameMode: firstRoundData.gameMode,
          currentCountry: firstRoundData.country || null,
          currentLetter: firstRoundData.letter || null,
          currentCategory: firstRoundData.category || null,
          currentTriviaQuestion: firstRoundData.triviaQuestion || null,
          currentCity: firstRoundData.city || null,
          currentWord: firstRoundData.word || null,
          currentWordCategory: firstRoundData.wordCategory || null,
          currentStadium: firstRoundData.stadium || null,
          availableAnswersCount: firstRoundData.availableAnswersCount || null,
          scrambledWord: scrambled,
          isRoundActive: true,
          roundTimer: ROUND_TIMER_SECONDS,
        };
      } else { // Knockout
        return {
          ...initialState,
          hostUsername: state.hostUsername,
          leaderboard: state.leaderboard, // Preserve global leaderboard
          gameStyle: gameStyle,
          maxWinners: maxWinners,
          knockoutCategory: knockoutCategory || null,
          gameState: GameState.KnockoutRegistration,
        };
      }
    }
    case 'PROCESS_COMMENT': {
        const message = action.payload;
        const newChatMessages = [message, ...state.chatMessages].slice(0, 100);
        if (!state.isRoundActive) return { ...state, chatMessages: newChatMessages };
        
        const comment = message.comment.trim();

        // --- MINESWEEPER LOGIC START ---
        if (state.gameMode === GameMode.Minesweeper && state.gameStyle === GameStyle.Knockout) {
            const { knockoutMatchPoints, currentBracketRoundIndex, currentMatchIndex, knockoutBracket } = state;
            if (currentBracketRoundIndex === null || currentMatchIndex === null || !knockoutBracket) return { ...state, chatMessages: newChatMessages };
            
            const match = knockoutBracket[currentBracketRoundIndex][currentMatchIndex];
            
            // Check if player is in the current match (using userId)
            if (message.userId !== match.player1?.userId && message.userId !== match.player2?.userId) {
                 return { ...state, chatMessages: newChatMessages };
            }

            // Parse coordinate (e.g., "A1", "C3")
            const matchCoord = comment.toUpperCase().match(/^([A-E])\s*([1-5])$/);
            if (!matchCoord) return { ...state, chatMessages: newChatMessages };
            
            const cellId = `${matchCoord[1]}${matchCoord[2]}`;
            const cellIndex = state.minesweeperGrid.findIndex(c => c.id === cellId);
            
            if (cellIndex === -1 || state.minesweeperGrid[cellIndex].isRevealed) {
                return { ...state, chatMessages: newChatMessages };
            }

            const cell = state.minesweeperGrid[cellIndex];
            const newGrid = [...state.minesweeperGrid];

            // 1. HIT MINE -> INSTANT LOSS for current player (Opponent Wins)
            if (cell.isMine) {
                newGrid[cellIndex] = { 
                    ...cell, 
                    isRevealed: true, 
                    exploded: true,
                    revealedBy: {
                        userId: message.userId,
                        profilePictureUrl: message.profilePictureUrl || `https://i.pravatar.cc/40?u=${message.userId}`
                    }
                };
                
                return {
                     ...state,
                     isRoundActive: false, // Stop the round immediately
                     minesweeperGrid: newGrid,
                     chatMessages: [{ ...message, comment: `BOOM! ${comment} adalah ranjau!`, isWinner: false }, ...state.chatMessages].slice(0, 100),
                }
            } 
            
            // 2. SAFE CELL -> Point for current player (for visual feedback)
            newGrid[cellIndex] = { 
                ...cell, 
                isRevealed: true,
                revealedBy: {
                    userId: message.userId,
                    profilePictureUrl: message.profilePictureUrl || `https://i.pravatar.cc/40?u=${message.userId}`
                }
            };
            
            const newPoints = { ...knockoutMatchPoints };
            if (message.userId === match.player1?.userId) {
                newPoints.player1++;
            } else {
                newPoints.player2++;
            }

            return {
                ...state,
                minesweeperGrid: newGrid,
                knockoutMatchPoints: newPoints,
                chatMessages: [{ ...message, isWinner: true }, ...state.chatMessages].slice(0, 100),
            };
        }
        // --- MINESWEEPER LOGIC END ---

        // Helper function to check for a whole word/phrase match, case-insensitively
        const checkAnswer = (commentText: string, answer: string): boolean => {
          if (!answer) return false;
          // Escape special regex characters in the answer
          const escapedAnswer = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Create a regex to find the answer as a whole word/phrase
          const regex = new RegExp(`\\b${escapedAnswer}\\b`, 'i');
          return regex.test(commentText);
        };
        
        let isCorrect = false;
        let foundAnswer = '';

        if (state.gameMode === GameMode.ABC5Dasar && state.currentLetter && state.currentCategory) {
            const validationList = getValidationList(state.currentCategory)
                .filter(item => item.toLowerCase().startsWith(state.currentLetter!.toLowerCase()))
                .filter(item => !state.usedAnswers.includes(item.toLowerCase()));
            
            validationList.sort((a, b) => b.length - a.length);

            for (const validItem of validationList) {
                if (checkAnswer(comment, validItem)) {
                    isCorrect = true;
                    foundAnswer = validItem;
                    break;
                }
            }
        } else if (state.gameMode === GameMode.Math) {
            // Check exact number match for Math
            if (state.currentMathQuestion && comment === state.currentMathQuestion.answer.toString()) {
                isCorrect = true;
                foundAnswer = state.currentMathQuestion.answer.toString();
            }
        } else {
            let expectedAnswer = '';
            switch (state.gameMode) {
                case GameMode.GuessTheFlag: expectedAnswer = state.currentCountry?.name || ''; break;
                case GameMode.GuessTheWord: expectedAnswer = state.currentWord || ''; break;
                case GameMode.GuessTheCity: expectedAnswer = state.currentCity?.name || ''; break;
                case GameMode.Trivia: expectedAnswer = state.currentTriviaQuestion?.answer || ''; break;
                case GameMode.ZonaBola: expectedAnswer = state.currentWord || state.currentStadium?.name || ''; break;
            }
            if (expectedAnswer && checkAnswer(comment, expectedAnswer)) {
                isCorrect = true;
                foundAnswer = expectedAnswer;
            }
        }

        if (isCorrect) {
            // Special handling for host/admin answers. Mark as winner for visual feedback but don't affect game.
            if (state.hostUsername && message.userId.toLowerCase() === state.hostUsername.toLowerCase()) {
                return {
                    ...state,
                    chatMessages: [ { ...message, isWinner: true }, ...state.chatMessages].slice(0,100),
                };
            }

            const winnerPlayer = { userId: message.userId, nickname: message.nickname, profilePictureUrl: message.profilePictureUrl };
            if (state.gameStyle === GameStyle.Classic) {
                if (state.roundWinners.some(w => w.userId === message.userId)) return { ...state, chatMessages: newChatMessages };
                const currentMaxWinners = state.gameMode === GameMode.ABC5Dasar && state.availableAnswersCount != null 
                        ? Math.min(state.maxWinners, state.availableAnswersCount) 
                        : state.maxWinners;
                if (state.roundWinners.length >= currentMaxWinners) return { ...state, chatMessages: newChatMessages };

                const timeTaken = ROUND_TIMER_SECONDS - state.roundTimer;
                const score = BASE_POINTS + Math.max(0, (ROUND_TIMER_SECONDS - timeTaken) * SPEED_BONUS_MULTIPLIER);
                const newWinner: RoundWinner = { ...winnerPlayer, score, time: timeTaken, answer: state.gameMode === GameMode.ABC5Dasar ? foundAnswer : undefined };
                
                const playerIndex = state.leaderboard.findIndex(p => p.userId === message.userId);
                
                const playerDocRef = doc(db, "leaderboard", message.userId);
                if (playerIndex > -1) {
                    updateDoc(playerDocRef, {
                        score: increment(score),
                        nickname: message.nickname,
                        profilePictureUrl: message.profilePictureUrl
                    }).catch(err => console.error("Firebase update failed: ", err));
                } else {
                    const oldPlayer = state.leaderboard.find(p => p.userId === message.userId);
                    const oldScore = oldPlayer ? oldPlayer.score : 0;
                    const newPlayerEntry = {
                        userId: message.userId,
                        nickname: message.nickname,
                        profilePictureUrl: message.profilePictureUrl,
                        score: oldScore + score
                    };
                    setDoc(playerDocRef, newPlayerEntry).catch(err => console.error("Firebase set failed: ", err));
                }

                const updatedLeaderboard = [...state.leaderboard];
                if (playerIndex > -1) {
                    updatedLeaderboard[playerIndex] = { ...updatedLeaderboard[playerIndex], score: updatedLeaderboard[playerIndex].score + score };
                } else {
                    updatedLeaderboard.push({ ...winnerPlayer, score });
                }
                updatedLeaderboard.sort((a, b) => b.score - a.score);
                
                const updatedSessionLeaderboard = [...state.sessionLeaderboard];
                const sessionPlayerIndex = updatedSessionLeaderboard.findIndex(p => p.userId === message.userId);
                if (sessionPlayerIndex > -1) updatedSessionLeaderboard[sessionPlayerIndex].score += score;
                else updatedSessionLeaderboard.push({ ...winnerPlayer, score });
                updatedSessionLeaderboard.sort((a, b) => b.score - a.score);

                return {
                    ...state,
                    chatMessages: [ { ...message, isWinner: true }, ...state.chatMessages].slice(0,100),
                    roundWinners: [...state.roundWinners, newWinner],
                    leaderboard: updatedLeaderboard,
                    sessionLeaderboard: updatedSessionLeaderboard,
                    usedAnswers: state.gameMode === GameMode.ABC5Dasar ? [...state.usedAnswers, foundAnswer.toLowerCase()] : state.usedAnswers,
                };
            } else { // Knockout mode point scored (Classic Trivia/Word/Math types)
                const { knockoutMatchPoints, currentBracketRoundIndex, currentMatchIndex, knockoutBracket } = state;
                if (currentBracketRoundIndex === null || currentMatchIndex === null || !knockoutBracket) return state;
                const match = knockoutBracket![currentBracketRoundIndex!][currentMatchIndex!];
                
                if (winnerPlayer.userId !== match.player1?.userId && winnerPlayer.userId !== match.player2?.userId) {
                    return { ...state, chatMessages: newChatMessages };
                }
                
                const newPoints = {...knockoutMatchPoints};
                if(winnerPlayer.userId === match.player1?.userId) newPoints.player1++;
                else newPoints.player2++;
                
                return { 
                    ...state, 
                    isRoundActive: false,
                    knockoutMatchPoints: newPoints,
                    chatMessages: [ { ...message, isWinner: true }, ...state.chatMessages].slice(0,100),
                };
            }
        }
        return { ...state, chatMessages: newChatMessages };
    }
    case 'TICK_TIMER': {
        if (!state.isRoundActive) return state;
        if (state.roundTimer > 0) {
            return { ...state, roundTimer: state.roundTimer - 1 };
        }
        return state;
    }
    case 'END_ROUND': {
      if (!state.isRoundActive) return state;

      let updatedWinners = [...state.roundWinners];
      let updatedSessionLeaderboard = [...state.sessionLeaderboard];
      if (state.gameMode === GameMode.ABC5Dasar) {
        const answerCounts = new Map<string, number>();
        updatedWinners.forEach(w => {
          if (w.answer) {
            answerCounts.set(w.answer.toLowerCase(), (answerCounts.get(w.answer.toLowerCase()) || 0) + 1);
          }
        });
        updatedWinners = updatedWinners.map(w => {
          if (w.answer && answerCounts.get(w.answer.toLowerCase()) === 1) {
            const newScore = w.score + UNIQUENESS_BONUS_POINTS;
            const sessionPlayer = updatedSessionLeaderboard.find(p => p.userId === w.userId);
            if (sessionPlayer) sessionPlayer.score += UNIQUENESS_BONUS_POINTS;
            return { ...w, score: newScore, bonus: UNIQUENESS_BONUS_POINTS };
          }
          return w;
        });
        updatedSessionLeaderboard.sort((a, b) => b.score - a.score);
      }

      // Check if this is the final round of a classic game
      if (state.gameStyle === GameStyle.Classic && state.round >= TOTAL_ROUNDS) {
        return {
          ...state,
          isRoundActive: false,
          gameState: GameState.Champion,
          roundWinners: updatedWinners,
          sessionLeaderboard: updatedSessionLeaderboard,
        };
      }
    
      const correctlyOrderedWord: LetterObject[][] = state.scrambledWord.map(wordArray => {
        const realLetters = wordArray.filter(letterObj => !letterObj.isDecoy);
        return realLetters.sort((a, b) => {
          const getIndex = (id: string) => parseInt(id.split('-i')[1], 10);
          return getIndex(a.id) - getIndex(b.id);
        });
      });
    
      return {
        ...state,
        isRoundActive: false,
        gameState: GameState.ClassicAnswerReveal,
        roundWinners: updatedWinners,
        sessionLeaderboard: updatedSessionLeaderboard,
        scrambledWord: correctlyOrderedWord,
      };
    }
    case 'PROCEED_TO_NEXT_CLASSIC_ROUND': {
        // This action centralizes the logic to proceed to the next round in Classic mode, making it more robust.
        if (state.round >= TOTAL_ROUNDS) {
            return { ...state, showWinnerModal: false, gameState: GameState.Champion, isRoundActive: false };
        }

        const nextRoundDeck = [...state.classicRoundDeck];
        const nextGameMode = nextRoundDeck.shift();

        if (!nextGameMode) {
            return { ...state, showWinnerModal: false, gameState: GameState.Champion, isRoundActive: false };
        }

        // --- Logic from old finishWinnerDisplay to get payload ---
        const getPayloadForRound = (gameMode: GameMode, category: ClassicCategorySelection, usedDataRef: any): Partial<GameActionPayloads['START_GAME']['firstRoundData']> => {
            const payload: Partial<GameActionPayloads['START_GAME']['firstRoundData']> = { gameMode };
             switch(category) {
                case 'GuessTheCountry':
                     const country = getNewCountry(usedDataRef.current.countries);
                     usedDataRef.current.countries.push(country);
                     payload.country = country;
                     break;
                case 'Trivia':
                     const trivia = getNewTrivia(usedDataRef.current.trivia);
                     usedDataRef.current.trivia.push(trivia);
                     payload.triviaQuestion = trivia;
                     break;
                case 'GuessTheCity':
                     const city = getNewCity(usedDataRef.current.cities);
                     usedDataRef.current.cities.push(city);
                     payload.city = city;
                     break;
                case 'KpopTrivia':
                    const kpop = getNewKpopTrivia(usedDataRef.current.kpopTrivia);
                    usedDataRef.current.kpopTrivia.push(kpop);
                    payload.triviaQuestion = kpop;
                    break;
                case 'ZonaBola':
                    const types: WordCategory[] = ['Pemain Bola', 'Klub Bola', 'Stadion Bola'];
                    const type = shuffleArray(types)[0];
                    payload.wordCategory = type;
                    if (type === 'Stadion Bola') {
                        const stadium = getNewStadium(usedDataRef.current.stadiums);
                        usedDataRef.current.stadiums.push(stadium);
                        payload.stadium = stadium;
                    } else {
                        const word = getNewWord(type, usedDataRef.current.words);
                        usedDataRef.current.words.push(word);
                        payload.word = word;
                    }
                    break;
                case 'GuessTheFruit':
                    const fruit = getNewWord('Buah-buahan', usedDataRef.current.words);
                    usedDataRef.current.words.push(fruit);
                    payload.word = fruit;
                    payload.wordCategory = 'Buah-buahan';
                    break;
                case 'GuessTheAnimal':
                    const animal = getNewWord('Hewan', usedDataRef.current.words);
                    usedDataRef.current.words.push(animal);
                    payload.word = animal;
                    payload.wordCategory = 'Hewan';
                    break;
            }
            return payload;
        };
        
        // This part is tricky because the reducer should be pure. However, `useGameLogic` is designed with a non-pure reducer that has access to the hook's scope.
        // We will proceed with this pattern for minimal disruption.
        const usedDataRef = (action as any)._usedDataRef; // A conceptual way to pass it, though not ideal. In reality, it's available via closure.

        let payload: Partial<GameActionPayloads['START_GAME']['firstRoundData']> = { gameMode: nextGameMode };

        if (state.classicCategorySelection === 'Random') {
             if (nextGameMode === GameMode.GuessTheFlag) {
                const country = getNewCountry(usedDataRef.current.countries);
                usedDataRef.current.countries.push(country);
                payload.country = country;
            } else if (nextGameMode === GameMode.Trivia) {
                 const question = getNewTrivia(usedDataRef.current.trivia);
                 usedDataRef.current.trivia.push(question);
                 payload.triviaQuestion = question;
            } else if (nextGameMode === GameMode.GuessTheCity) {
                const city = getNewCity(usedDataRef.current.cities);
                usedDataRef.current.cities.push(city);
                payload.city = city;
            }
        } else {
            payload = getPayloadForRound(nextGameMode, state.classicCategorySelection, usedDataRef);
        }

        // --- Logic from old NEXT_ROUND reducer to apply payload ---
        const newRound = state.round + 1;
        const { country, letter, category, availableAnswersCount, word, wordCategory, triviaQuestion, city, stadium } = payload;
        const scrambled = country ? scrambleWord(country.name)
                        : word ? scrambleWord(word)
                        : triviaQuestion ? scrambleWord(triviaQuestion.answer)
                        : city ? scrambleWord(city.name)
                        : stadium ? scrambleWord(stadium.name)
                        : [];

        return {
            ...state,
            gameState: GameState.Playing,
            round: newRound,
            gameMode: nextGameMode,
            currentCountry: country || null,
            currentLetter: letter || null,
            currentCategory: category || null,
            currentWord: word || null,
            currentWordCategory: wordCategory || null,
            currentTriviaQuestion: triviaQuestion || null,
            currentCity: city || null,
            currentStadium: stadium || null,
            availableAnswersCount: availableAnswersCount || null,
            scrambledWord: scrambled,
            usedAnswers: [],
            isRoundActive: true,
            roundWinners: [],
            roundTimer: ROUND_TIMER_SECONDS,
            showWinnerModal: false,
            allAnswersFoundInRound: false,
            classicRoundDeck: nextRoundDeck,
        };
    }
    case 'SHOW_WINNER_MODAL':
        return { ...state, showWinnerModal: true };
    case 'HIDE_WINNER_MODAL':
        return { ...state, showWinnerModal: false };
    case 'PAUSE_GAME':
        return { ...state, isRoundActive: false, isPausedByAdmin: true, gameState: GameState.Paused };
    case 'RESUME_GAME':
        return { ...state, isRoundActive: true, isPausedByAdmin: false, gameState: state.gameStyle === GameStyle.Classic ? GameState.Playing : GameState.KnockoutPlaying };
    case 'RESET_GAME':
      return createInitialState();
    case 'START_COUNTDOWN':
      return { ...state, countdownValue: 3 };
    case 'TICK_COUNTDOWN': {
      if (state.countdownValue !== null && state.countdownValue > 0) {
        return { ...state, countdownValue: state.countdownValue - 1 };
      }
      return state;
    }
    case 'END_REGISTRATION_AND_DRAW_BRACKET': {
        if (state.knockoutPlayers.length < 2) return state;
        const newBracket = generateBracket(state.knockoutPlayers);
        return {
            ...state,
            knockoutBracket: newBracket,
            gameState: GameState.KnockoutDrawing,
        };
    }
    case 'REGISTER_PLAYER': {
        if (state.knockoutPlayers.some(p => p.userId === action.payload.userId)) {
            return state; // Already registered
        }
        return {
            ...state,
            knockoutPlayers: [...state.knockoutPlayers, action.payload]
        };
    }
    case 'RESET_KNOCKOUT_REGISTRATION': {
        return {
            ...state,
            knockoutPlayers: [],
            knockoutBracket: null,
            currentBracketRoundIndex: null,
            currentMatchIndex: null,
        };
    }
    case 'SET_KNOCKOUT_COUNTRY': {
        return {
            ...state,
            gameMode: GameMode.GuessTheFlag,
            currentCountry: action.payload.country,
            scrambledWord: scrambleWord(action.payload.country.name),
        };
    }
    case 'SET_KNOCKOUT_TRIVIA': {
        return {
            ...state,
            gameMode: GameMode.Trivia,
            currentTriviaQuestion: action.payload.question,
            scrambledWord: scrambleWord(action.payload.question.answer),
        };
    }
    case 'SET_KNOCKOUT_ZONA_BOLA': {
        const wordToScramble = typeof action.payload.data === 'string' ? action.payload.data : action.payload.data.name;
        return {
            ...state,
            gameMode: GameMode.ZonaBola,
            currentWordCategory: action.payload.type,
            currentWord: typeof action.payload.data === 'string' ? action.payload.data : null,
            currentStadium: typeof action.payload.data !== 'string' ? action.payload.data : null,
            scrambledWord: scrambleWord(wordToScramble),
        };
    }
    case 'SET_KNOCKOUT_GUESS_THE_FRUIT': {
        return {
            ...state,
            gameMode: GameMode.GuessTheWord,
            currentWordCategory: 'Buah-buahan',
            currentWord: action.payload.fruit,
            scrambledWord: scrambleWord(action.payload.fruit),
        };
    }
    case 'SET_KNOCKOUT_GUESS_THE_ANIMAL': {
        return {
            ...state,
            gameMode: GameMode.GuessTheWord,
            currentWordCategory: 'Hewan',
            currentWord: action.payload.animal,
            scrambledWord: scrambleWord(action.payload.animal),
        };
    }
    case 'SET_KNOCKOUT_KPOP_TRIVIA': {
        return {
            ...state,
            gameMode: GameMode.Trivia,
            currentTriviaQuestion: action.payload.question,
            scrambledWord: scrambleWord(action.payload.question.answer),
        };
    }
    case 'SET_KNOCKOUT_MINESWEEPER': {
      return {
          ...state,
          gameMode: GameMode.Minesweeper,
          minesweeperGrid: generateMinesweeperGrid(),
      };
    }
    case 'SET_KNOCKOUT_MATH': {
      return {
          ...state,
          gameMode: GameMode.Math,
          currentMathQuestion: action.payload.question,
          scrambledWord: [],
      };
    }
    case 'PREPARE_NEXT_MATCH': {
        return {
            ...state,
            gameState: GameState.KnockoutPrepareMatch,
            currentBracketRoundIndex: action.payload.roundIndex,
            currentMatchIndex: action.payload.matchIndex,
            countdownValue: KNOCKOUT_PREPARE_SECONDS,
        };
    }
    case 'START_MATCH': {
        return {
            ...state,
            gameState: GameState.KnockoutPlaying,
            isRoundActive: true,
            roundTimer: state.gameMode === GameMode.Minesweeper ? 999 : KNOCKOUT_ROUND_TIMER_SECONDS, // Effectively no timer for minesweeper
            knockoutMatchPoints: { player1: 0, player2: 0 },
        };
    }
    case 'SET_READY_TO_PLAY': {
        return { ...state, gameState: GameState.KnockoutReadyToPlay };
    }
    case 'FINISH_KNOCKOUT_MATCH': {
        const { winner, score } = action.payload;
        const { currentBracketRoundIndex, currentMatchIndex, knockoutBracket } = state;
        if (currentBracketRoundIndex === null || currentMatchIndex === null || !knockoutBracket) return state;

        const newBracket = JSON.parse(JSON.stringify(knockoutBracket));
        const match = newBracket[currentBracketRoundIndex][currentMatchIndex];
        match.winner = winner;
        match.score = score;

        const finalBracket = advanceWinnerInBracket(newBracket, winner, currentBracketRoundIndex, currentMatchIndex);
        
        const isOver = isTournamentOver(finalBracket, currentBracketRoundIndex);
        
        return {
            ...state,
            knockoutBracket: finalBracket,
            gameState: isOver ? GameState.Champion : GameState.KnockoutShowWinner,
            sessionLeaderboard: isOver ? [{ ...winner, score: 1 }] : [],
        };
    }
    case 'DECLARE_WALKOVER_WINNER': {
        const { winner, roundIndex, matchIndex } = action.payload;
        const { knockoutBracket } = state;
        if (!knockoutBracket) return state;

        const newBracket = JSON.parse(JSON.stringify(knockoutBracket));
        const match = newBracket[roundIndex][matchIndex];
        match.winner = winner;
        match.score = "WO"; // Walkover

        const finalBracket = advanceWinnerInBracket(newBracket, winner, roundIndex, matchIndex);

        return {
            ...state,
            knockoutBracket: finalBracket,
        };
    }
    case 'REDRAW_BRACKET': {
        const redrawnBracket = generateBracket(state.knockoutPlayers);
        return {
            ...state,
            knockoutBracket: redrawnBracket,
            gameState: GameState.KnockoutDrawing,
        };
    }
    case 'RESTART_KNOCKOUT_COMPETITION': {
        return {
            ...state,
            knockoutPlayers: [],
            knockoutBracket: null,
            currentBracketRoundIndex: null,
            currentMatchIndex: null,
            gameState: GameState.KnockoutRegistration,
        };
    }
    case 'RETURN_TO_BRACKET': {
        return { ...state, gameState: GameState.KnockoutReadyToPlay };
    }
    case 'FINISH_GAME': {
        return { ...state, gameState: GameState.Finished };
    }
    case 'RETURN_TO_MODE_SELECTION': {
        return {
            ...state,
            gameState: GameState.ModeSelection,
            round: 0,
            sessionLeaderboard: [],
            knockoutPlayers: [],
            knockoutBracket: null,
            currentBracketRoundIndex: null,
            currentMatchIndex: null,
        };
    }
    case 'SET_HOST_USERNAME': {
        return { ...state, hostUsername: action.payload.username };
    }
    // New action to set leaderboard from Firestore
    case 'SET_LEADERBOARD': {
        return { ...state, leaderboard: action.payload.leaderboard };
    }
    default:
        return state;
  }
};

const getValidationList = (category: AbcCategory): string[] => {
    switch(category) {
        case 'Negara': return countries.map(c => c.name);
        case 'Buah': return fruits;
        case 'Hewan': return animals;
        case 'Benda': return objects;
        case 'Profesi': return professions;
        case 'Kota di Indonesia': return indonesianCities;
        case 'Tumbuhan': return plants;
        default: return [];
    }
};

// --- GETTERS FOR NEW ROUND DATA ---
const getNewCountry = (used: Country[]): Country => shuffleArray(countries.filter(c => !used.some(u => u.code === c.code)))[0];
const getNewTrivia = (used: TriviaQuestion[]): TriviaQuestion => shuffleArray(triviaQuestions.filter(q => !used.includes(q)))[0];
const getNewCity = (used: City[]): City => shuffleArray(cities.filter(c => !used.includes(c)))[0];
const getNewKpopTrivia = (used: TriviaQuestion[]): TriviaQuestion => shuffleArray(kpopTrivia.filter(q => !used.includes(q)))[0];
const getNewWord = (category: WordCategory, used: string[]): string => {
    let wordList: string[] = [];
    if (category === 'Pemain Bola') wordList = footballPlayers;
    else if (category === 'Klub Bola') wordList = footballClubs;
    else if (category === 'Buah-buahan') wordList = fruits;
    else if (category === 'Hewan') wordList = animals;
    return shuffleArray(wordList.filter(w => !used.includes(w)))[0];
};
const getNewStadium = (used: FootballStadium[]): FootballStadium => shuffleArray(footballStadiums.filter(s => !used.includes(s)))[0];


export const useGameLogic = () => {
    const [state, dispatch] = useReducer(gameReducer, createInitialState());
    const timerRef = useRef<number | null>(null);
    const usedDataRef = useRef<{
        countries: Country[],
        words: string[],
        stadiums: FootballStadium[],
        trivia: TriviaQuestion[],
        cities: City[],
        kpopTrivia: TriviaQuestion[],
    }>({ countries: [], words: [], stadiums: [], trivia: [], cities: [], kpopTrivia: [] });

    // Fetch initial leaderboard from Firestore
    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(200));
                const querySnapshot = await getDocs(q);
                const lb: LeaderboardEntry[] = [];
                querySnapshot.forEach(doc => {
                    lb.push(doc.data() as LeaderboardEntry);
                });
                dispatch({ type: 'SET_LEADERBOARD', payload: { leaderboard: lb }});
            } catch (error) {
                console.error("Failed to fetch leaderboard from Firestore:", error);
            }
        };
        fetchLeaderboard();
    }, []);

    const currentAnswer = (() => {
        if (!state.isRoundActive) return '';
        switch (state.gameMode) {
            case GameMode.GuessTheFlag: return state.currentCountry?.name || '';
            case GameMode.GuessTheWord: return state.currentWord || '';
            case GameMode.Trivia: return state.currentTriviaQuestion?.answer || '';
            case GameMode.GuessTheCity: return state.currentCity?.name || '';
            case GameMode.ZonaBola: return state.currentWord || state.currentStadium?.name || '';
            case GameMode.Math: return state.currentMathQuestion?.answer.toString() || '';
            case GameMode.ABC5Dasar:
                const count = state.availableAnswersCount;
                return count !== null ? `(${count} jawaban tersedia)` : '';
            default: return '';
        }
    })();

    // Firebase State Sync
    const prevStateRef = useRef<string>();
    useEffect(() => {
        const stateToSync = {
            status: (state.gameState === GameState.Setup || state.gameState === GameState.Connecting) ? 'offline' : 'online',
            connectedUsername: state.hostUsername,
            gameState: state.gameState,
            round: state.round,
            currentAnswer: currentAnswer,
            gameMode: state.gameMode,
            knockoutCategory: state.knockoutCategory,
        };

        const currentStateJson = JSON.stringify(stateToSync);

        if (currentStateJson !== prevStateRef.current) {
            const sessionRef = doc(db, "gameSessions", "live");
            setDoc(sessionRef, stateToSync, { merge: true });
            prevStateRef.current = currentStateJson;
        }
    }, [state.gameState, state.round, state.hostUsername, currentAnswer, state.gameMode, state.knockoutCategory]);


    // --- CLASSIC GAME TIMER & ROUND LOGIC ---
    useEffect(() => {
        if (state.gameState === GameState.Playing && state.isRoundActive) {
            timerRef.current = window.setInterval(() => {
                dispatch({ type: 'TICK_TIMER' });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [state.gameState, state.isRoundActive]);

    useEffect(() => {
        if (state.gameState === GameState.Playing && state.isRoundActive) {
            const currentMaxWinners = state.gameMode === GameMode.ABC5Dasar && state.availableAnswersCount != null 
                ? Math.min(state.maxWinners, state.availableAnswersCount) 
                : state.maxWinners;

            const allAnswersFound = state.roundWinners.length >= currentMaxWinners;
            if (state.roundTimer <= 0 || allAnswersFound) {
                dispatch({ type: 'END_ROUND' });
            }
        }
    }, [state.roundTimer, state.roundWinners.length, state.isRoundActive, state.gameState, state.gameMode, state.availableAnswersCount, state.maxWinners]);

    useEffect(() => {
        let timeoutId: number;
        if (state.gameState === GameState.ClassicAnswerReveal) {
            timeoutId = window.setTimeout(() => {
                dispatch({ type: 'SHOW_WINNER_MODAL' });
            }, ANSWER_REVEAL_DELAY_SECONDS * 1000);
        }
        return () => window.clearTimeout(timeoutId);
    }, [state.gameState]);


    // --- KNOCKOUT GAME TIMER & MATCH LOGIC ---
    const knockoutTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (knockoutTimerRef.current) {
            clearTimeout(knockoutTimerRef.current);
            clearInterval(knockoutTimerRef.current);
        }
    
        if (state.gameState === GameState.KnockoutPrepareMatch) {
            if (state.countdownValue !== null && state.countdownValue > 0) {
                knockoutTimerRef.current = window.setTimeout(() => dispatch({ type: 'TICK_COUNTDOWN' }), 1000);
            } else if (state.countdownValue === 0) { 
                dispatch({ type: 'START_MATCH' });
            }
        } else if (state.gameState === GameState.KnockoutPlaying) {
            if (state.isRoundActive && state.gameMode !== GameMode.Minesweeper) {
                knockoutTimerRef.current = window.setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
            }
    
            const { knockoutMatchPoints, currentBracketRoundIndex, currentMatchIndex, knockoutBracket, minesweeperGrid } = state;
            if (!knockoutBracket || currentBracketRoundIndex === null || currentMatchIndex === null) return;
            const match = knockoutBracket[currentBracketRoundIndex][currentMatchIndex];
            if (!match || !match.player1 || !match.player2) return;
            
            let winner: KnockoutPlayer | null = null;
            let hasMatchFinished = false;
    
            if (!state.isRoundActive) { // Match completion check
                if (state.gameMode === GameMode.Minesweeper) {
                    const explodedCell = minesweeperGrid.find(c => c.exploded);
                    if (explodedCell && explodedCell.revealedBy) {
                        const loserId = explodedCell.revealedBy.userId;
                        winner = loserId === match.player1.userId ? match.player2 : match.player1;
                        hasMatchFinished = true;
                    }
                } else { // Other knockout modes
                    if (knockoutMatchPoints.player1 >= KNOCKOUT_TARGET_SCORE) winner = match.player1;
                    else if (knockoutMatchPoints.player2 >= KNOCKOUT_TARGET_SCORE) winner = match.player2;
                    if (winner) hasMatchFinished = true;
                }
    
                if (hasMatchFinished && winner) {
                    let score = `${knockoutMatchPoints.player1}-${knockoutMatchPoints.player2}`;
                    if(state.gameMode === GameMode.Minesweeper && minesweeperGrid.some(c => c.exploded)) {
                        score = "BOM 💣";
                    }
                    knockoutTimerRef.current = window.setTimeout(() => dispatch({ type: 'FINISH_KNOCKOUT_MATCH', payload: { winner: winner!, score } }), 1000);
                }
            }
        } else if (state.gameState === GameState.KnockoutShowWinner) {
            knockoutTimerRef.current = window.setTimeout(() => dispatch({ type: 'RETURN_TO_BRACKET' }), KNOCKOUT_WINNER_VIEW_SECONDS * 1000);
        } else if (state.gameState === GameState.KnockoutDrawing) {
            knockoutTimerRef.current = window.setTimeout(() => dispatch({ type: 'SET_READY_TO_PLAY' }), 1000);
        }

        return () => {
          if(knockoutTimerRef.current) {
            clearTimeout(knockoutTimerRef.current);
            clearInterval(knockoutTimerRef.current);
          }
        };
    }, [state.gameState, state.countdownValue, state.knockoutMatchPoints, state.isRoundActive]);

    const getCurrentKnockoutMatch = useCallback(() => {
        if (state.knockoutBracket && state.currentBracketRoundIndex !== null && state.currentMatchIndex !== null) {
            return state.knockoutBracket[state.currentBracketRoundIndex][state.currentMatchIndex];
        }
        return null;
    }, [state.knockoutBracket, state.currentBracketRoundIndex, state.currentMatchIndex]);

    const finishWinnerDisplay = useCallback(() => {
        const action: GameAction = { 
            type: 'PROCEED_TO_NEXT_CLASSIC_ROUND',
            // @ts-ignore - a little hack to pass the non-serializable ref to the reducer via closure
            _usedDataRef: usedDataRef 
        };
        dispatch(action);
    }, []);

    const getGameModeForClassicCategory = (category: ClassicCategorySelection): GameMode => {
        switch(category) {
            case 'GuessTheCountry': return GameMode.GuessTheFlag;
            case 'Trivia': return GameMode.Trivia;
            case 'ZonaBola': return GameMode.ZonaBola;
            case 'GuessTheFruit': return GameMode.GuessTheWord;
            case 'GuessTheAnimal': return GameMode.GuessTheWord;
            case 'KpopTrivia': return GameMode.Trivia;
            case 'GuessTheCity': return GameMode.GuessTheCity;
            default: return GameMode.GuessTheFlag; // Fallback
        }
    };

    const startGame = useCallback((gameStyle: GameStyle, maxWinners: number, options?: { knockoutCategory?: KnockoutCategory, classicCategory?: ClassicCategorySelection }) => {
        usedDataRef.current = { countries: [], words: [], stadiums: [], trivia: [], cities: [], kpopTrivia: [] };
        
        if (gameStyle === GameStyle.Classic) {
            const category = options?.classicCategory || 'Random';
            let deck: GameMode[] = [];

            if (category === 'Random') {
                const flagRounds = Array(10).fill(GameMode.GuessTheFlag);
                const triviaRounds = Array(3).fill(GameMode.Trivia);
                const cityRounds = Array(2).fill(GameMode.GuessTheCity);
                deck = shuffleArray([...flagRounds, ...triviaRounds, ...cityRounds]);
            } else {
                const gameMode = getGameModeForClassicCategory(category);
                deck = Array(TOTAL_ROUNDS).fill(gameMode);
            }

            const getPayloadForRound = (gameMode: GameMode, category: ClassicCategorySelection): Partial<GameActionPayloads['START_GAME']['firstRoundData']> => {
                const payload: Partial<GameActionPayloads['START_GAME']['firstRoundData']> = { gameMode };
                switch(category) {
                    case 'GuessTheCountry':
                         const country = getNewCountry(usedDataRef.current.countries);
                         usedDataRef.current.countries.push(country);
                         payload.country = country;
                         break;
                    case 'Trivia':
                         const trivia = getNewTrivia(usedDataRef.current.trivia);
                         usedDataRef.current.trivia.push(trivia);
                         payload.triviaQuestion = trivia;
                         break;
                    case 'GuessTheCity':
                         const city = getNewCity(usedDataRef.current.cities);
                         usedDataRef.current.cities.push(city);
                         payload.city = city;
                         break;
                    case 'KpopTrivia':
                        const kpop = getNewKpopTrivia(usedDataRef.current.kpopTrivia);
                        usedDataRef.current.kpopTrivia.push(kpop);
                        payload.triviaQuestion = kpop;
                        break;
                    case 'ZonaBola':
                        const types: WordCategory[] = ['Pemain Bola', 'Klub Bola', 'Stadion Bola'];
                        const type = shuffleArray(types)[0];
                        payload.wordCategory = type;
                        if (type === 'Stadion Bola') {
                            const stadium = getNewStadium(usedDataRef.current.stadiums);
                            usedDataRef.current.stadiums.push(stadium);
                            payload.stadium = stadium;
                        } else {
                            const word = getNewWord(type, usedDataRef.current.words);
                            usedDataRef.current.words.push(word);
                            payload.word = word;
                        }
                        break;
                    case 'GuessTheFruit':
                        const fruit = getNewWord('Buah-buahan', usedDataRef.current.words);
                        usedDataRef.current.words.push(fruit);
                        payload.word = fruit;
                        payload.wordCategory = 'Buah-buahan';
                        break;
                    case 'GuessTheAnimal':
                        const animal = getNewWord('Hewan', usedDataRef.current.words);
                        usedDataRef.current.words.push(animal);
                        payload.word = animal;
                        payload.wordCategory = 'Hewan';
                        break;
                }
                return payload;
            };

            const firstGameMode = deck.shift()!;
            let firstRoundPayload: GameActionPayloads['START_GAME']['firstRoundData'] = { gameMode: firstGameMode };

            if(category === 'Random') {
                 if (firstGameMode === GameMode.GuessTheFlag) {
                    const country = getNewCountry(usedDataRef.current.countries);
                    usedDataRef.current.countries.push(country);
                    firstRoundPayload.country = country;
                } else if (firstGameMode === GameMode.Trivia) {
                     const question = getNewTrivia(usedDataRef.current.trivia);
                     usedDataRef.current.trivia.push(question);
                     firstRoundPayload.triviaQuestion = question;
                } else if (firstGameMode === GameMode.GuessTheCity) {
                    const city = getNewCity(usedDataRef.current.cities);
                    usedDataRef.current.cities.push(city);
                    firstRoundPayload.city = city;
                }
            } else {
                firstRoundPayload = { ...getPayloadForRound(firstGameMode, category), gameMode: firstGameMode };
            }

            dispatch({ type: 'START_GAME', payload: { gameStyle, maxWinners, classicCategorySelection: category, classicRoundDeck: deck, firstRoundData: firstRoundPayload } });
        } else {
             dispatch({ type: 'START_GAME', payload: { gameStyle, maxWinners, knockoutCategory: options?.knockoutCategory } });
        }
    }, []);

    const prepareNextMatch = useCallback((payload: { roundIndex: number; matchIndex: number }) => {
        dispatch({ type: 'PREPARE_NEXT_MATCH', payload });
        
        switch (state.knockoutCategory) {
            case 'GuessTheCountry': {
                const country = getNewCountry(usedDataRef.current.countries);
                usedDataRef.current.countries.push(country);
                dispatch({ type: 'SET_KNOCKOUT_COUNTRY', payload: { country } });
                break;
            }
            case 'Trivia': {
                 const question = getNewTrivia(usedDataRef.current.trivia);
                 usedDataRef.current.trivia.push(question);
                 dispatch({ type: 'SET_KNOCKOUT_TRIVIA', payload: { question } });
                 break;
            }
            case 'KpopTrivia': {
                 const question = getNewKpopTrivia(usedDataRef.current.kpopTrivia);
                 usedDataRef.current.kpopTrivia.push(question);
                 dispatch({ type: 'SET_KNOCKOUT_KPOP_TRIVIA', payload: { question } });
                 break;
            }
            case 'ZonaBola': {
                const types: ('Pemain Bola' | 'Klub Bola' | 'Stadion Bola')[] = ['Pemain Bola', 'Klub Bola', 'Stadion Bola'];
                const type = shuffleArray(types)[0];
                if (type === 'Pemain Bola' || type === 'Klub Bola') {
                    const word = getNewWord(type, usedDataRef.current.words);
                    usedDataRef.current.words.push(word);
                    dispatch({ type: 'SET_KNOCKOUT_ZONA_BOLA', payload: { type, data: word } });
                } else {
                    const stadium = getNewStadium(usedDataRef.current.stadiums);
                    usedDataRef.current.stadiums.push(stadium);
                    dispatch({ type: 'SET_KNOCKOUT_ZONA_BOLA', payload: { type, data: stadium } });
                }
                break;
            }
            case 'GuessTheFruit': {
                const fruit = getNewWord('Buah-buahan', usedDataRef.current.words);
                usedDataRef.current.words.push(fruit);
                dispatch({ type: 'SET_KNOCKOUT_GUESS_THE_FRUIT', payload: { fruit } });
                break;
            }
            case 'GuessTheAnimal': {
                const animal = getNewWord('Hewan', usedDataRef.current.words);
                usedDataRef.current.words.push(animal);
                dispatch({ type: 'SET_KNOCKOUT_GUESS_THE_ANIMAL', payload: { animal } });
                break;
            }
            case 'Minesweeper': {
                dispatch({ type: 'SET_KNOCKOUT_MINESWEEPER', payload: {} });
                break;
            }
            case 'Math': {
                const question = generateMathQuestion();
                dispatch({ type: 'SET_KNOCKOUT_MATH', payload: { question } });
                break;
            }
        }
    }, [state.knockoutCategory]);

    const skipRound = useCallback(() => dispatch({ type: 'END_ROUND' }), []);
    const pauseGame = useCallback(() => dispatch({ type: 'PAUSE_GAME' }), []);
    const resumeGame = useCallback(() => dispatch({ type: 'RESUME_GAME' }), []);
    const processComment = useCallback((message: ChatMessage) => dispatch({ type: 'PROCESS_COMMENT', payload: message }), []);
    const registerPlayer = useCallback((player: KnockoutPlayer) => dispatch({ type: 'REGISTER_PLAYER', payload: player }), []);
    const endRegistrationAndDrawBracket = useCallback(() => dispatch({ type: 'END_REGISTRATION_AND_DRAW_BRACKET' }), []);
    const resetKnockoutRegistration = useCallback(() => dispatch({ type: 'RESET_KNOCKOUT_REGISTRATION' }), []);
    const redrawBracket = useCallback(() => dispatch({ type: 'REDRAW_BRACKET' }), []);
    const restartKnockoutCompetition = useCallback(() => dispatch({ type: 'RESTART_KNOCKOUT_COMPETITION' }), []);
    const declareWalkoverWinner = useCallback((payload: GameActionPayloads['DECLARE_WALKOVER_WINNER']) => dispatch({ type: 'DECLARE_WALKOVER_WINNER', payload }), []);
    const returnToBracket = useCallback(() => dispatch({ type: 'RETURN_TO_BRACKET' }), []);
    const finishGame = useCallback(() => dispatch({ type: 'FINISH_GAME' }), []);
    const returnToModeSelection = useCallback(() => dispatch({ type: 'RETURN_TO_MODE_SELECTION' }), []);
    const setHostUsername = useCallback((username: string) => dispatch({ type: 'SET_HOST_USERNAME', payload: { username } }), []);

    return {
        state,
        currentAnswer,
        startGame,
        skipRound,
        pauseGame,
        resumeGame,
        processComment,
        finishWinnerDisplay,
        registerPlayer,
        endRegistrationAndDrawBracket,
        resetKnockoutRegistration,
        getCurrentKnockoutMatch,
        prepareNextMatch,
        redrawBracket,
        restartKnockoutCompetition,
        declareWalkoverWinner,
        returnToBracket,
        finishGame,
        returnToModeSelection,
        setHostUsername,
    };
};