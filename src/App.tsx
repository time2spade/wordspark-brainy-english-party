import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Flame, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Users, 
  User, 
  Radio, 
  RotateCcw, 
  BookOpen, 
  Trophy, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Clock, 
  HelpCircle,
  Copy,
  Zap,
  Play,
  Award,
  Medal,
  ChevronRight
} from 'lucide-react';

import { 
  isValidWord, 
  getWordDefinition, 
  generateSharedChallengeBoard, 
  evaluateWordRush, 
  ChallengePrompt, 
  WordSprintScore,
  WordDefinition 
} from './dictionary';
import { sounds } from './audio';
import { 
  P2PManager, 
  Player, 
  LeaderboardEntry, 
  AVATAR_OPTIONS, 
  generateRoomCode, 
  NetworkMessage 
} from './p2p';

type GameMode = 'MENU' | 'SOLO' | 'P2P_HOST' | 'P2P_GUEST';
type PlayState = 'LOBBY' | 'PLAYING' | 'GAME_OVER';

interface ScoredWordEntry {
  word: string;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  matchedChallengeTitles: string[];
  timestamp: number;
}

export default function App() {
  // Navigation & Sound
  const [gameMode, setGameMode] = useState<GameMode>('MENU');
  const [playState, setPlayState] = useState<PlayState>('LOBBY');
  const [isMuted, setIsMuted] = useState<boolean>(sounds.isMuted);

  // Modals
  const [showDefinitionModal, setShowDefinitionModal] = useState<WordDefinition | null>(null);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showHighScoresModal, setShowHighScoresModal] = useState<boolean>(false);
  const [lexiconSearchQuery, setLexiconSearchQuery] = useState<string>('');

  // 120s Shared Round State
  const [roundDuration] = useState<number>(120); // 120 seconds (2 minutes)
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [challenges, setChallenges] = useState<ChallengePrompt[]>([]);
  
  // Local Player Word & Score State
  const [currentInput, setCurrentInput] = useState<string>('');
  const [myScore, setMyScore] = useState<number>(0);
  const [myScoredWords, setMyScoredWords] = useState<ScoredWordEntry[]>([]);
  const [inputFeedback, setInputFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [shakingInput, setShakingInput] = useState<boolean>(false);

  // High Scores in localStorage
  const [soloHighScores, setSoloHighScores] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('wordrush_solo_highscores');
      return saved ? JSON.parse(saved) : [480, 360, 220];
    } catch {
      return [480, 360, 220];
    }
  });

  // Multiplayer / P2P State
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('WordNinja');
  const [playerAvatar, setPlayerAvatar] = useState<string>('⚡');
  const [p2pStatus, setP2PStatus] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('local_player');

  const p2pManagerRef = useRef<P2PManager | null>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<any>(null);

  // Toggle Sound Mute
  const handleToggleMute = () => {
    const next = sounds.toggleMute();
    setIsMuted(next);
  };

  // Best Word for local player
  const myBestWord = useMemo(() => {
    if (myScoredWords.length === 0) return { word: '—', totalScore: 0 };
    return [...myScoredWords].sort((a, b) => b.totalScore - a.totalScore)[0];
  }, [myScoredWords]);

  // ----------------------------------------------------
  // SOLO MODE (1 PLAYER)
  // ----------------------------------------------------
  const startSoloSprint = () => {
    sounds.playClick();
    setGameMode('SOLO');
    const newChallenges = generateSharedChallengeBoard();
    setChallenges(newChallenges);
    setMyScore(0);
    setMyScoredWords([]);
    setCurrentInput('');
    setTimeLeft(roundDuration);
    setLiveLeaderboard([]);
    setPlayState('PLAYING');

    setTimeout(() => wordInputRef.current?.focus(), 150);
  };

  // ----------------------------------------------------
  // ROUND TIMER (120 SECONDS)
  // ----------------------------------------------------
  useEffect(() => {
    if (playState !== 'PLAYING') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          handleRoundFinished();
          return 0;
        }
        // Final 10 seconds: urgent audio ticker
        if (prev <= 10) {
          sounds.playTick(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [playState, myScore]);

  // Round Over Trigger
  const handleRoundFinished = () => {
    sounds.playWhistle();
    setPlayState('GAME_OVER');
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });

    // Save Solo High Score
    if (gameMode === 'SOLO') {
      setSoloHighScores(prev => {
        const updated = [...prev, myScore].sort((a, b) => b - a).slice(0, 5);
        localStorage.setItem('wordrush_solo_highscores', JSON.stringify(updated));
        return updated;
      });
    }

    // If Host, broadcast END_GAME
    if (gameMode === 'P2P_HOST') {
      p2pManagerRef.current?.broadcast({
        type: 'END_GAME',
        payload: { leaderboard: liveLeaderboard }
      });
    }
  };

  // ----------------------------------------------------
  // WORD SUBMISSION & INSTANT LOCAL SCORING
  // ----------------------------------------------------
  const handleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playState !== 'PLAYING') return;

    const candidate = currentInput.trim().toUpperCase();
    if (!candidate) return;

    const existingWords = myScoredWords.map(w => w.word);
    const result: WordSprintScore = evaluateWordRush(candidate, challenges, existingWords);

    if (!result.valid) {
      sounds.playError();
      triggerInputShake(result.reason || 'Invalid word!');
      return;
    }

    // Positive chord sound on valid word score!
    sounds.playSuccess();

    const newScore = myScore + result.totalScore;
    const newEntry: ScoredWordEntry = {
      word: result.word,
      baseScore: result.baseScore,
      bonusScore: result.bonusScore,
      totalScore: result.totalScore,
      matchedChallengeTitles: result.matchedChallengeTitles,
      timestamp: Date.now()
    };

    const updatedWords = [newEntry, ...myScoredWords];
    setMyScore(newScore);
    setMyScoredWords(updatedWords);
    setCurrentInput('');

    // Feedback message highlighting score & bonuses
    const bonusText = result.bonusScore > 0 ? ` (+${result.bonusScore} Match Bonus!)` : '';
    triggerInputSuccess(`+${result.totalScore} pts!${bonusText}`);

    // Determine current best word
    const bestScored = [...updatedWords].sort((a, b) => b.totalScore - a.totalScore)[0];

    // Transmit score to network if multiplayer
    if (gameMode === 'P2P_GUEST') {
      p2pManagerRef.current?.sendToHost({
        type: 'UPDATE_SCORE',
        payload: {
          playerId: myPlayerId,
          score: newScore,
          wordCount: updatedWords.length,
          bestWord: bestScored.word,
          bestWordPoints: bestScored.totalScore
        }
      });
    } else if (gameMode === 'P2P_HOST') {
      // Host updates self in leaderboard and broadcasts
      updateHostLeaderboard(myPlayerId, newScore, updatedWords.length, bestScored.word, bestScored.totalScore);
    }
  };

  const triggerInputShake = (msg: string) => {
    setInputFeedback({ message: msg, isError: true });
    setShakingInput(true);
    setTimeout(() => setShakingInput(false), 300);
    setTimeout(() => setInputFeedback(null), 2500);
  };

  const triggerInputSuccess = (msg: string) => {
    setInputFeedback({ message: msg, isError: false });
    setTimeout(() => setInputFeedback(null), 2000);
  };

  // ----------------------------------------------------
  // MULTIPLAYER (P2P WEBRTC ROOMS)
  // ----------------------------------------------------
  const handleHostCreateRoom = async () => {
    sounds.playClick();
    const code = generateRoomCode();
    setRoomCode(code);
    setP2PStatus('Creating WebRTC room...');
    setGameMode('P2P_HOST');
    setPlayState('LOBBY');

    const manager = new P2PManager(
      (msg: NetworkMessage) => handleP2PHostMessage(msg),
      (status: string, isErr?: boolean) => {
        setP2PStatus(status);
        if (isErr) triggerInputShake(status);
      }
    );
    p2pManagerRef.current = manager;

    try {
      await manager.createRoom(code);
      setMyPlayerId(manager.myPeerId);

      const hostPlayer: Player = {
        id: manager.myPeerId,
        name: `${playerName} (Host)`,
        avatar: playerAvatar,
        isHost: true,
        score: 0,
        wordCount: 0,
        bestWord: '—',
        bestWordPoints: 0
      };
      setPlayers([hostPlayer]);
      setLiveLeaderboard([hostPlayer]);
    } catch (err: any) {
      triggerInputShake('Network issue. You can play Solo mode anytime with full local dictionary!');
    }
  };

  const handleP2PHostMessage = (msg: NetworkMessage) => {
    if (msg.type === 'JOIN_REQUEST') {
      sounds.playClick();
      const guestId = msg.payload.id || msg.senderId || `guest_${Date.now()}`;
      const newPlayer: Player = {
        id: guestId,
        name: msg.payload.name || `Player ${players.length + 1}`,
        avatar: msg.payload.avatar || '🐼',
        isHost: false,
        score: 0,
        wordCount: 0,
        bestWord: '—',
        bestWordPoints: 0
      };

      setPlayers(prev => {
        if (prev.some(p => p.id === guestId)) return prev;
        if (prev.length >= 12) return prev; // max 12 players
        const updated = [...prev, newPlayer];
        p2pManagerRef.current?.broadcast({
          type: 'PLAYER_LIST_UPDATE',
          payload: { players: updated }
        });
        return updated;
      });
    } else if (msg.type === 'UPDATE_SCORE') {
      const { playerId, score, wordCount, bestWord, bestWordPoints } = msg.payload;
      updateHostLeaderboard(playerId, score, wordCount, bestWord, bestWordPoints);
    }
  };

  const updateHostLeaderboard = (
    pid: string, 
    score: number, 
    wordCount: number, 
    bestWord: string, 
    bestWordPoints: number
  ) => {
    setPlayers(prev => {
      const updated = prev.map(p => {
        if (p.id === pid) {
          return { ...p, score, wordCount, bestWord, bestWordPoints };
        }
        return p;
      });

      // Sort ranking by score descending
      const ranked: LeaderboardEntry[] = [...updated]
        .sort((a, b) => b.score - a.score || b.wordCount - a.wordCount)
        .map((p, idx) => ({ ...p, rank: idx + 1 }));

      setLiveLeaderboard(ranked);

      // Broadcast leaderboard update to all guests
      p2pManagerRef.current?.broadcast({
        type: 'LEADERBOARD_SYNC',
        payload: { ranking: ranked }
      });

      return updated;
    });
  };

  const handleGuestJoinRoom = async () => {
    if (!joinCodeInput.trim()) {
      triggerInputShake('Please enter the 4-letter room code!');
      return;
    }
    sounds.playClick();
    const code = joinCodeInput.trim().toUpperCase();
    setP2PStatus(`Connecting to room ${code}...`);
    setGameMode('P2P_GUEST');
    setPlayState('LOBBY');

    const manager = new P2PManager(
      (msg: NetworkMessage) => handleP2PGuestMessage(msg),
      (status: string, isErr?: boolean) => {
        setP2PStatus(status);
        if (isErr) triggerInputShake(status);
      }
    );
    p2pManagerRef.current = manager;

    try {
      await manager.joinRoom(code, playerName, playerAvatar);
      setMyPlayerId(manager.myPeerId);
    } catch (err: any) {
      triggerInputShake('Could not connect. Verify room code or host status.');
    }
  };

  const handleP2PGuestMessage = (msg: NetworkMessage) => {
    if (msg.type === 'PLAYER_LIST_UPDATE') {
      if (msg.payload.players) {
        setPlayers(msg.payload.players);
        setLiveLeaderboard(msg.payload.players);
      }
    } else if (msg.type === 'START_GAME') {
      sounds.playSuccess();
      setChallenges(msg.payload.challenges);
      setTimeLeft(msg.payload.duration || 120);
      setMyScore(0);
      setMyScoredWords([]);
      setCurrentInput('');
      setPlayState('PLAYING');
      setTimeout(() => wordInputRef.current?.focus(), 150);
    } else if (msg.type === 'LEADERBOARD_SYNC') {
      if (msg.payload.ranking) {
        setLiveLeaderboard(msg.payload.ranking);
      }
    } else if (msg.type === 'END_GAME') {
      sounds.playWhistle();
      setPlayState('GAME_OVER');
      if (msg.payload.leaderboard) {
        setLiveLeaderboard(msg.payload.leaderboard);
      }
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    }
  };

  // Host starts the simultaneous 120s sprint
  const handleHostStartGame = () => {
    sounds.playClick();
    const newChallenges = generateSharedChallengeBoard();
    setChallenges(newChallenges);
    setMyScore(0);
    setMyScoredWords([]);
    setCurrentInput('');
    setTimeLeft(roundDuration);

    // Reset scores in player roster
    const resetPlayers = players.map(p => ({
      ...p,
      score: 0,
      wordCount: 0,
      bestWord: '—',
      bestWordPoints: 0
    }));
    setPlayers(resetPlayers);
    setLiveLeaderboard(resetPlayers);

    // Broadcast START_GAME to all clients
    p2pManagerRef.current?.broadcast({
      type: 'START_GAME',
      payload: {
        challenges: newChallenges,
        duration: roundDuration
      }
    });

    setPlayState('PLAYING');
    setTimeout(() => wordInputRef.current?.focus(), 150);
  };

  // Inspect Word Definition
  const inspectWord = (word: string) => {
    sounds.playClick();
    const def = getWordDefinition(word);
    setShowDefinitionModal(def);
  };

  // Return to Menu
  const returnToMenu = () => {
    sounds.playClick();
    p2pManagerRef.current?.destroy();
    setGameMode('MENU');
    setPlayState('LOBBY');
  };

  const copyRoomCode = () => {
    navigator.clipboard?.writeText(roomCode);
    sounds.playClick();
    triggerInputSuccess(`Room code ${roomCode} copied!`);
  };

  // Formatted Timer (e.g. "01:45")
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#0b101d] text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      
      {/* ======================================================== */}
      {/* 1. TOP BAR */}
      {/* ======================================================== */}
      <header className="w-full bg-[#111728]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-40">
        <button 
          onClick={returnToMenu}
          className="flex items-center gap-2 group cursor-pointer focus-visible:outline-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Flame className="w-5 h-5 text-white animate-spark" />
          </div>
          <div className="text-left">
            <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-white block leading-none">
              WordSpark
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-amber-400 tracking-wider uppercase">
              Simultaneous Word Rush
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowRulesModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="How to Play"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Rules</span>
          </button>

          <button
            onClick={() => setShowHighScoresModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Lexicon & Scores"
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="hidden sm:inline">Scores</span>
          </button>

          <button
            onClick={handleToggleMute}
            className="p-2 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white cursor-pointer"
            title={isMuted ? "Unmute" : "Mute"}
            aria-label="Sound Toggle"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {gameMode !== 'MENU' && (
            <button
              onClick={returnToMenu}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          )}
        </div>
      </header>

      {/* Floating Feedback Notice */}
      {inputFeedback && (
        <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm font-bold backdrop-blur-md animate-bounce ${
          inputFeedback.isError 
            ? 'bg-rose-950/90 border border-rose-500/60 text-rose-200' 
            : 'bg-emerald-950/90 border border-emerald-500/60 text-emerald-200'
        }`}>
          {inputFeedback.isError ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{inputFeedback.message}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN CONTAINER */}
      {/* ======================================================== */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 flex flex-col justify-center">

        {/* ---------------------------------------------------- */}
        {/* A. TITLE & MODE SELECT */}
        {/* ---------------------------------------------------- */}
        {gameMode === 'MENU' && (
          <div className="flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 my-auto">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-3 animate-bomb-pulse">
                <Flame className="w-12 h-12 text-white animate-spark" />
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-white">
                Word<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">Spark</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto mt-2">
                Simultaneous Vocabulary Sprint for 1 to 12 players. All players race against the 120s clock together with zero waiting!
              </p>
            </div>

            {/* Quick Profile Setup */}
            <div className="bg-[#141c30] border border-slate-800 rounded-2xl p-4 w-full max-w-md text-left flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  const cur = AVATAR_OPTIONS.indexOf(playerAvatar);
                  setPlayerAvatar(AVATAR_OPTIONS[(cur + 1) % AVATAR_OPTIONS.length]);
                }}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-2xl shrink-0 cursor-pointer shadow-inner"
                title="Tap to change avatar"
              >
                {playerAvatar}
              </button>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Nickname</label>
                <input
                  type="text"
                  maxLength={14}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full bg-transparent border-none text-white font-bold text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Mode Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              {/* Solo 120s Sprint */}
              <div className="bg-[#141c30] border border-slate-800 hover:border-amber-500/60 rounded-3xl p-6 text-left flex flex-col justify-between group transition-all duration-200 hover:-translate-y-1 shadow-xl">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400 group-hover:scale-110 transition-transform">
                    <User className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-white">Solo 120s Sprint</h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
                    Jump straight into a 2-minute sprint. Solve shared board prompts, score big vocabulary, and beat your personal record.
                  </p>
                </div>
                <button
                  onClick={startSoloSprint}
                  className="mt-6 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer active:translate-y-0.5"
                >
                  <Play className="w-4 h-4 fill-current" /> Start Solo Sprint
                </button>
              </div>

              {/* Multiplayer Room (1–12 Players) */}
              <div className="bg-[#141c30] border border-slate-800 hover:border-cyan-500/60 rounded-3xl p-6 text-left flex flex-col justify-between group transition-all duration-200 hover:-translate-y-1 shadow-xl">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-3 text-cyan-400 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-white">Multiplayer Word Rush</h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
                    1 to 12 players simultaneous clash! Connect via 4-letter room code. Zero lag, live leaderboard sync every second.
                  </p>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={handleHostCreateRoom}
                    className="flex-1 py-3 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider text-center cursor-pointer active:translate-y-0.5 shadow-md shadow-cyan-500/20"
                  >
                    Host Room
                  </button>
                  <button
                    onClick={() => {
                      setGameMode('P2P_GUEST');
                      setPlayState('LOBBY');
                    }}
                    className="flex-1 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-display font-extrabold text-xs uppercase tracking-wider text-center cursor-pointer active:translate-y-0.5"
                  >
                    Join Room
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Scoring Banner */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
              <span className="text-amber-400 font-semibold">3-4 letters: 10 pts</span>
              <span>·</span>
              <span className="text-orange-400 font-semibold">5-6 letters: 25 pts</span>
              <span>·</span>
              <span className="text-rose-400 font-semibold">7+ letters: 50 pts</span>
              <span>·</span>
              <span className="text-emerald-400 font-semibold">Match Bonus: +20 pts</span>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* B. MULTIPLAYER HOST LOBBY */}
        {/* ---------------------------------------------------- */}
        {gameMode === 'P2P_HOST' && playState === 'LOBBY' && (
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg mx-auto space-y-6 shadow-2xl">
            <div className="text-center">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Multiplayer Host</span>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">Word Rush Room</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Tell friends to enter this 4-letter room code on their phone or laptop:
              </p>
            </div>

            <div className="bg-[#0b101d] border-2 border-cyan-500/40 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-widest block mb-1">Room Code</span>
              <span className="text-4xl font-display font-black tracking-widest text-white selection:bg-cyan-500">
                {roomCode}
              </span>
              <button
                onClick={copyRoomCode}
                className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Code
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2 px-1">
                <span>Roster ({players.length}/12 Players)</span>
                <span>{p2pStatus}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {players.map(p => (
                  <div key={p.id} className="bg-[#0e1424] p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
                    <span className="text-xl">{p.avatar}</span>
                    <span className="text-xs font-bold text-white truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleHostStartGame}
              className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 cursor-pointer active:translate-y-0.5"
            >
              <Play className="w-4 h-4 fill-current" /> Start 120s Simultaneous Sprint!
            </button>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* C. MULTIPLAYER GUEST LOBBY */}
        {/* ---------------------------------------------------- */}
        {gameMode === 'P2P_GUEST' && playState === 'LOBBY' && (
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md mx-auto space-y-6 shadow-2xl">
            <div className="text-center">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Join Room</span>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">Enter Room Code</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  4-Letter Room Code
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. RUSH"
                  className="w-full text-center text-3xl font-display font-black tracking-widest bg-[#0b101d] border-2 border-slate-700 focus:border-cyan-400 rounded-2xl p-3 text-white uppercase outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="w-full bg-[#0b101d] border border-slate-700 focus:border-cyan-400 rounded-xl p-3 text-white text-sm font-semibold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Choose Avatar
                </label>
                <div className="flex flex-wrap gap-2 justify-center">
                  {AVATAR_OPTIONS.map(av => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setPlayerAvatar(av)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center cursor-pointer transition-transform ${playerAvatar === av ? 'bg-cyan-500 scale-110 shadow-md shadow-cyan-500/30' : 'bg-slate-800 hover:bg-slate-700'}`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGuestJoinRoom}
              className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 active:translate-y-0.5"
            >
              <Radio className="w-4 h-4" /> Connect & Wait for Start
            </button>

            {p2pStatus && (
              <p className="text-center text-xs text-cyan-300 font-semibold animate-pulse">{p2pStatus}</p>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* D. ACTIVE 120s SIMULTANEOUS PLAYFIELD */}
        {/* ---------------------------------------------------- */}
        {playState === 'PLAYING' && (
          <div className="space-y-4 sm:space-y-5">
            
            {/* Header Status Strip: Shared Timer & Local Score */}
            <div className="bg-[#141c30] border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Your Score</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-display font-black text-amber-400 tabular-nums">
                    {myScore}
                  </span>
                  <span className="text-xs font-bold text-slate-400">pts</span>
                </div>
              </div>

              {/* Real-time 120s Countdown Timer */}
              <div className="text-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Round Timer</span>
                <div className={`flex items-center justify-center gap-1 font-display text-3xl sm:text-4xl font-black tabular-nums ${
                  timeLeft <= 10 ? 'text-rose-500 animate-pulse' : timeLeft <= 30 ? 'text-orange-400' : 'text-emerald-400'
                }`}>
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>

              {/* Words Count & Best Word */}
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Words Scored</span>
                <span className="text-2xl sm:text-3xl font-display font-bold text-cyan-400 tabular-nums">
                  {myScoredWords.length}
                </span>
              </div>
            </div>

            {/* LIVE LEADERBOARD MINI SCOREBOARD (Visible in Multiplayer) */}
            {(gameMode === 'P2P_HOST' || gameMode === 'P2P_GUEST') && liveLeaderboard.length > 0 && (
              <div className="bg-[#0e1526] border border-cyan-500/30 rounded-2xl p-3 shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2 px-1">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Live Rush Ranking
                  </span>
                  <span className="text-slate-400 font-normal">Syncing every word</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {liveLeaderboard.slice(0, 4).map((entry, idx) => {
                    const isMe = entry.id === myPlayerId;
                    return (
                      <div 
                        key={entry.id}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                          isMe 
                            ? 'bg-cyan-500/20 border border-cyan-500/50 text-white font-bold' 
                            : 'bg-[#141c30] border border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`w-4 text-center font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : 'text-amber-600'}`}>
                            #{idx + 1}
                          </span>
                          <span>{entry.avatar}</span>
                          <span className="truncate max-w-[70px]">{entry.name}</span>
                        </div>
                        <span className="font-display font-extrabold text-amber-400 tabular-nums ml-1">
                          {entry.score}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DYNAMIC SHARED CHALLENGE BOARD */}
            <div className="bg-[#101726] border border-slate-800/90 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Shared Challenge Board (+20 Bonus Pts Each)
                </span>
                <span className="text-[10px] text-slate-400">Everyone shares this board</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {challenges.map(c => (
                  <div 
                    key={c.id} 
                    className="bg-[#151f36] border border-slate-700/80 rounded-xl p-2.5 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full inline-block mb-1">
                        {c.badge}
                      </span>
                      <h4 className="font-display font-bold text-sm text-white leading-tight">
                        {c.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                        {c.description}
                      </p>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold mt-2 block">
                      +{c.bonus} Bonus Pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* WORD INPUT FIELD & SUBMIT */}
            <form onSubmit={handleWordSubmit} className="flex gap-2">
              <input
                ref={wordInputRef}
                type="text"
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value.toUpperCase())}
                placeholder="Type words fast and press Enter..."
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck="false"
                className={`flex-1 bg-[#141c30] border-2 ${
                  shakingInput ? 'border-rose-500 animate-shake' : 'border-slate-700 focus:border-amber-400'
                } text-white text-lg sm:text-xl font-bold px-4 py-3 rounded-2xl outline-none transition-colors tracking-widest placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-sm`}
              />
              <button
                type="submit"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-sm sm:text-base px-6 py-3 rounded-2xl cursor-pointer shadow-lg shadow-orange-500/20 active:translate-y-0.5"
              >
                Score!
              </button>
            </form>

            {/* MY RECENT WORD STACK */}
            <div className="bg-[#101726] border border-slate-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Your Scored Words ({myScoredWords.length}) · Click any to view definition
                </span>
                <span className="text-xs text-amber-400 font-medium">
                  Best: {myBestWord.word} ({myBestWord.totalScore} pts)
                </span>
              </div>

              {myScoredWords.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs italic">
                  No words scored yet. Type any valid 3+ letter English word matching the board!
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {myScoredWords.map((item, idx) => (
                    <button
                      key={`${item.word}-${idx}`}
                      onClick={() => inspectWord(item.word)}
                      className="group bg-[#162035] hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span className="text-white group-hover:text-amber-300">{item.word}</span>
                      <span className="text-[10px] text-amber-400 tabular-nums">+{item.totalScore}</span>
                      {item.matchedChallengeTitles.length > 0 && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded">
                          ★ match
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* E. GAME OVER & PODIUM SCREEN */}
        {/* ---------------------------------------------------- */}
        {playState === 'GAME_OVER' && (
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto space-y-6 shadow-2xl">
            <div className="text-center">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">120s Round Complete</span>
              <h2 className="text-3xl font-display font-black text-white mt-1">Vocabulary Sprint Podium</h2>
            </div>

            {/* MULTIPLAYER PODIUM (If 2+ players) */}
            {liveLeaderboard.length >= 2 ? (
              <div className="grid grid-cols-3 gap-2 items-end pt-4 pb-2 text-center">
                {/* 2nd Place */}
                <div className="bg-[#0e1424] p-3 rounded-2xl border border-slate-800 flex flex-col items-center">
                  <span className="text-2xl mb-1">{liveLeaderboard[1]?.avatar || '🥈'}</span>
                  <span className="text-xs font-bold text-slate-300 truncate max-w-full">
                    {liveLeaderboard[1]?.name || 'Player 2'}
                  </span>
                  <span className="text-lg font-display font-black text-slate-200 mt-1">
                    {liveLeaderboard[1]?.score || 0} pts
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">2nd Place</span>
                </div>

                {/* 1st Place Champion */}
                <div className="bg-gradient-to-b from-amber-500/20 to-orange-500/10 p-4 rounded-2xl border-2 border-amber-500 shadow-xl flex flex-col items-center -translate-y-2">
                  <span className="text-3xl mb-1">{liveLeaderboard[0]?.avatar || '👑'}</span>
                  <span className="text-sm font-bold text-white truncate max-w-full">
                    {liveLeaderboard[0]?.name || 'Champion'}
                  </span>
                  <span className="text-2xl font-display font-black text-amber-400 mt-1">
                    {liveLeaderboard[0]?.score || 0} pts
                  </span>
                  <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase mt-1">
                    1st Winner
                  </span>
                </div>

                {/* 3rd Place */}
                <div className="bg-[#0e1424] p-3 rounded-2xl border border-slate-800 flex flex-col items-center">
                  <span className="text-2xl mb-1">{liveLeaderboard[2]?.avatar || '🥉'}</span>
                  <span className="text-xs font-bold text-slate-300 truncate max-w-full">
                    {liveLeaderboard[2]?.name || 'Player 3'}
                  </span>
                  <span className="text-lg font-display font-black text-amber-600 mt-1">
                    {liveLeaderboard[2]?.score || 0} pts
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">3rd Place</span>
                </div>
              </div>
            ) : (
              /* Solo Summary Stats */
              <div className="grid grid-cols-3 gap-3 bg-[#0d1322] p-4 rounded-2xl border border-slate-800 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Final Score</span>
                  <span className="text-2xl font-display font-extrabold text-amber-400 tabular-nums">{myScore} pts</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Total Words</span>
                  <span className="text-2xl font-display font-extrabold text-cyan-400 tabular-nums">{myScoredWords.length}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Best Word</span>
                  <span className="text-lg font-display font-bold text-emerald-400 truncate block">{myBestWord.word}</span>
                </div>
              </div>
            )}

            {/* Detailed Player Breakdown Table */}
            {liveLeaderboard.length > 0 && (
              <div className="bg-[#0d1322] rounded-2xl border border-slate-800 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">
                  Full Ranking & Highest-Scoring Words
                </span>
                {liveLeaderboard.map((entry, idx) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded-xl text-xs bg-[#141c30]">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 text-center font-bold text-amber-400">#{idx + 1}</span>
                      <span>{entry.avatar}</span>
                      <span className="font-bold text-white truncate max-w-[100px]">{entry.name}</span>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="text-slate-400 text-[11px]">
                        Best: <span className="text-emerald-400 font-semibold">{entry.bestWord || '—'}</span>
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {entry.wordCount} words
                      </span>
                      <span className="font-display font-extrabold text-amber-400 tabular-nums">
                        {entry.score} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Local Words Inspection */}
            {myScoredWords.length > 0 && (
              <div className="text-left">
                <span className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Your Word Breakdown (Tap any for definition):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {myScoredWords.map(w => (
                    <button
                      key={w.word}
                      onClick={() => inspectWord(w.word)}
                      className="bg-[#0d1322] hover:bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      {w.word} <span className="text-amber-400">({w.totalScore}p)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {gameMode === 'P2P_HOST' ? (
                <button
                  onClick={handleHostStartGame}
                  className="flex-1 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  Start Next Round
                </button>
              ) : gameMode === 'SOLO' ? (
                <button
                  onClick={startSoloSprint}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  Play Again
                </button>
              ) : (
                <div className="flex-1 text-center text-xs text-slate-400 py-3 bg-[#0d1322] rounded-2xl border border-slate-800">
                  Waiting for host to start next round...
                </div>
              )}
              <button
                onClick={returnToMenu}
                className="py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Menu
              </button>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="w-full py-3 px-4 border-t border-slate-800/80 bg-[#0d1322] text-center text-xs text-slate-500">
        WordSpark: Brainy English Party · 1–12 Simultaneous Players · 2,600+ Word Lexicon
      </footer>

      {/* ======================================================== */}
      {/* 3. MODALS */}
      {/* ======================================================== */}

      {/* WORD DEFINITION POPUP */}
      {showDefinitionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141c30] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowDefinitionModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Lexicon Definition
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl sm:text-3xl font-display font-black text-white tracking-wide">
                  {showDefinitionModal.word}
                </h3>
                <span className="text-xs text-slate-400 italic">
                  [{showDefinitionModal.syllables} {showDefinitionModal.syllables === 1 ? 'syllable' : 'syllables'}]
                </span>
              </div>
              <span className="text-xs text-amber-300/80 font-semibold block mt-0.5">
                {showDefinitionModal.pos} {showDefinitionModal.category ? `· Topic: ${showDefinitionModal.category}` : ''}
              </span>
            </div>

            <div className="bg-[#0b101d] p-4 rounded-2xl border border-slate-800 space-y-2">
              <p className="text-sm text-slate-200 leading-relaxed">
                {showDefinitionModal.definition}
              </p>
              {showDefinitionModal.example && (
                <p className="text-xs text-slate-400 italic border-l-2 border-amber-500/40 pl-2.5 mt-2">
                  "{showDefinitionModal.example}"
                </p>
              )}
            </div>

            <button
              onClick={() => setShowDefinitionModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowRulesModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-2xl font-display font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-amber-400" /> How to Play Simultaneous Word Rush
            </h3>

            <div className="space-y-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="bg-[#0d1322] p-3.5 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block text-sm">1. Simultaneous 120s Sprint</span>
                <p>
                  Every round lasts exactly 120 seconds (2 minutes). All 1 to 12 players type words simultaneously on their own screen with zero waiting or turn locking!
                </p>
              </div>

              <div className="bg-[#0d1322] p-3.5 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-orange-400 block text-sm">2. Scoring System</span>
                <p>• <strong>3–4 letter word</strong>: 10 pts</p>
                <p>• <strong>5–6 letter word</strong>: 25 pts</p>
                <p>• <strong>7+ letter word</strong>: 50 pts</p>
                <p>• <strong>Board Challenge Match</strong>: +20 bonus pts each time your word matches an active prompt!</p>
              </div>

              <div className="bg-[#0d1322] p-3.5 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 block text-sm">3. Live Leaderboard & Podiums</span>
                <p>
                  Scores sync in real-time across devices. When the referee whistle blows at 0s, the podium crowns 1st, 2nd, and 3rd place champions!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Ready to Rush!
            </button>
          </div>
        </div>
      )}

      {/* SCORES & LEXICON MODAL */}
      {showHighScoresModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowHighScoresModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-2xl font-display font-bold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" /> High Scores & Dictionary
            </h3>

            {/* Solo High Scores Leaderboard */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Solo 120s Personal Best
              </span>
              <div className="bg-[#0d1322] rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
                {soloHighScores.map((score, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 text-sm">
                    <span className="font-bold text-slate-300 flex items-center gap-2">
                      <span className="w-6 text-center text-xs text-amber-400">#{idx + 1}</span>
                      Sprint Master
                    </span>
                    <span className="font-display font-bold text-amber-400 tabular-nums">
                      {score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Lexicon Lookup Tool */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Embedded English Lexicon (2,600+ Words)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lexiconSearchQuery}
                  onChange={e => setLexiconSearchQuery(e.target.value.toUpperCase())}
                  placeholder="Look up any English word..."
                  className="flex-1 bg-[#0d1322] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-sm outline-none"
                />
                <button
                  onClick={() => {
                    if (lexiconSearchQuery.trim()) {
                      inspectWord(lexiconSearchQuery.trim());
                    }
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase rounded-xl cursor-pointer"
                >
                  Inspect
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowHighScoresModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
