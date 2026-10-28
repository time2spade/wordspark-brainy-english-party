import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Flame, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Users, 
  Calendar, 
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
  ChevronRight,
  LogOut,
  LogIn,
  RefreshCw,
  CalendarDays,
  Target,
  ShieldCheck,
  Star,
  FlameKindling,
  Home,
  ArrowLeft
} from 'lucide-react';

import { 
  isValidWord, 
  getWordDefinition, 
  generateDailyChallengeBoard,
  generateSharedChallengeBoard, 
  evaluateWordRush, 
  getTodayDateString,
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
import { 
  firebaseService, 
  UserProfile, 
  DailyLeaderboardEntry 
} from './firebase';
import { AdBanner } from './components/AdComponents';
import { AffiliateModal } from './components/AffiliateModal';

type AppNavTab = 'HOME' | 'DAILY_RANKINGS' | 'PARTY_RUSH';
type GamePlayState = 'LOBBY' | 'PLAYING' | 'GAME_OVER';

interface ScoredWordEntry {
  word: string;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  matchedChallengeTitles: string[];
  timestamp: number;
}

export default function App() {
  // Navigation & User
  const [activeTab, setActiveTab] = useState<AppNavTab>('HOME');
  const [playState, setPlayState] = useState<GamePlayState>('LOBBY');
  const [gameModeType, setGameModeType] = useState<'DAILY_QUEST' | 'PARTY_RUSH'>('DAILY_QUEST');
  const [user, setUser] = useState<UserProfile | null>(firebaseService.getCurrentUser());
  const [isMuted, setIsMuted] = useState<boolean>(sounds.isMuted);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  // Modals
  const [showDefinitionModal, setShowDefinitionModal] = useState<WordDefinition | null>(null);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showSignInModal, setShowSignInModal] = useState<boolean>(false);
  const [showAffiliateModal, setShowAffiliateModal] = useState<boolean>(false);
  const [lexiconSearchQuery, setLexiconSearchQuery] = useState<string>('');
  const [authErrorDetail, setAuthErrorDetail] = useState<{
    code: string;
    title: string;
    message: string;
    domain?: string;
  } | null>(null);
  const [customAccountName, setCustomAccountName] = useState<string>('');

  // Daily Challenge State
  const todayDateStr = useMemo(() => getTodayDateString(), []);
  const [selectedRankingDate, setSelectedRankingDate] = useState<string>(todayDateStr);
  const [dailyBoardData, setDailyBoardData] = useState(() => generateDailyChallengeBoard(todayDateStr));
  const [isOfficialAttempt, setIsOfficialAttempt] = useState<boolean>(true);
  const [hasCompletedToday, setHasCompletedToday] = useState<boolean>(false);
  const [previousDailyScore, setPreviousDailyScore] = useState<number | null>(null);

  // Midnight Countdown
  const [timeUntilReset, setTimeUntilReset] = useState<string>('00h 00m 00s');

  // Active Game State
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [activeChallenges, setActiveChallenges] = useState<ChallengePrompt[]>([]);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [scoredWords, setScoredWords] = useState<ScoredWordEntry[]>([]);
  const [inputFeedback, setInputFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [shakingInput, setShakingInput] = useState<boolean>(false);
  const [isEvaluatingWord, setIsEvaluatingWord] = useState<boolean>(false);

  // Leaderboard Data
  const [dailyLeaderboard, setDailyLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // Multiplayer P2P State
  const [p2pMode, setP2PMode] = useState<'IDLE' | 'HOST' | 'GUEST'>('IDLE');
  const [isGuestConnected, setIsGuestConnected] = useState<boolean>(false);
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

  // Listen to Auth state changes
  useEffect(() => {
    const unsub = firebaseService.onAuthChange(currUser => {
      setUser(currUser);
      if (currUser) {
        setPlayerName(currUser.displayName);
        checkTodayCompletion(currUser.uid);
      }
    });
    return () => unsub();
  }, [todayDateStr]);

  const checkTodayCompletion = (uid: string) => {
    const completed = firebaseService.hasCompletedOfficialRun(uid, todayDateStr);
    setHasCompletedToday(completed);
    if (completed) {
      const savedScore = localStorage.getItem(`wordspark_score_${todayDateStr}_${uid}`);
      setPreviousDailyScore(savedScore ? parseInt(savedScore, 10) : null);
    }
  };

  // Midnight Countdown ticker
  useEffect(() => {
    const updateMidnightCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diffSecs = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
      const h = Math.floor(diffSecs / 3600);
      const m = Math.floor((diffSecs % 3600) / 60);
      const s = diffSecs % 60;
      setTimeUntilReset(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };

    updateMidnightCountdown();
    const interval = setInterval(updateMidnightCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Leaderboard for Selected Date
  const loadLeaderboard = async (dateStr: string) => {
    setIsLoadingLeaderboard(true);
    try {
      const entries = await firebaseService.fetchDailyLeaderboard(dateStr, user?.uid);
      setDailyLeaderboard(entries);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    // Initial fetch for today's leaderboard so home screen previews top scores
    loadLeaderboard(selectedRankingDate);
  }, [selectedRankingDate, user]);

  // Best Word for local player
  const myBestWord = useMemo(() => {
    if (scoredWords.length === 0) return { word: '—', totalScore: 0 };
    return [...scoredWords].sort((a, b) => b.totalScore - a.totalScore)[0];
  }, [scoredWords]);

  // User's own entry in daily leaderboard
  const myLeaderboardEntry = useMemo(() => {
    if (!user) return null;
    return dailyLeaderboard.find(entry => entry.uid === user.uid);
  }, [dailyLeaderboard, user]);

  // Owner/Admin Authorization: Only T2Spade@gmail.com or ?admin=true sees the affiliate manager
  const [adminModeKey, setAdminModeKey] = useState<number>(0);
  const isOwnerAdmin = useMemo(() => {
    if (user?.email && user.email.toLowerCase() === 't2spade@gmail.com') {
      return true;
    }
    if (typeof window !== 'undefined' && window.location) {
      const search = window.location.search.toLowerCase();
      if (search.includes('admin=true') || search.includes('partner=true')) {
        try {
          localStorage.setItem('wordspark_admin_mode', 'true');
        } catch (e) {}
        return true;
      }
    }
    try {
      if (localStorage.getItem('wordspark_admin_mode') === 'true') {
        return true;
      }
    } catch (e) {}
    return false;
  }, [user, adminModeKey]);

  // Audio Toggle
  const handleToggleMute = () => {
    const next = sounds.toggleMute();
    setIsMuted(next);
  };

  // Direct Google Sign In
  const handleDirectGoogleSignIn = async () => {
    sounds.playClick();
    setIsSigningIn(true);
    setAuthErrorDetail(null);
    try {
      const profile = await firebaseService.signInWithGoogle();
      triggerInputSuccess(`Welcome, ${profile.displayName}!`);
      setShowSignInModal(false);
    } catch (err: any) {
      if (err.message && err.message.includes('popup was closed')) {
        return;
      }
      const code = err.code || '';
      const currentHost = window.location.hostname;
      let title = 'Google Sign-In Notice';
      let msg = 'Could not authenticate with Google at this time.';
      let domain: string | undefined = undefined;

      if (code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized domain'))) {
        title = 'Firebase Domain Authorization Required';
        msg = `Domain "${currentHost}" is not yet authorized in Firebase Console. Add it in Firebase Console > Authentication > Settings > Authorized Domains, or play immediately with Instant Account below!`;
        domain = currentHost;
      } else if (code === 'auth/popup-blocked' || (err.message && err.message.includes('popup'))) {
        title = 'Popup Blocked by Browser';
        msg = 'Your browser or iframe preview blocked the sign-in popup. Enable popups or continue with Instant Account below.';
      } else if (code === 'auth/operation-not-allowed') {
        title = 'Google Provider Not Enabled';
        msg = 'Google provider is not enabled in Firebase Console (Authentication > Sign-in method). Use Instant Account below.';
      } else {
        msg = err.message || 'Google sign-in encountered an issue. You can use Instant Account below.';
      }

      setAuthErrorDetail({ code, title, message: msg, domain });
      setShowSignInModal(true);
      triggerInputShake(title);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleInstantSignIn = (nameToUse?: string) => {
    sounds.playClick();
    const finalName = (nameToUse && nameToUse.trim()) || (customAccountName && customAccountName.trim()) || 'Player';
    const profile = firebaseService.signInAsDemoUser(finalName);
    triggerInputSuccess(`Signed in as ${profile.displayName}!`);
    setShowSignInModal(false);
    setAuthErrorDetail(null);
  };

  const handleSignOut = async () => {
    sounds.playClick();
    await firebaseService.signOutUser();
    setUser(null);
    triggerInputSuccess('Signed out successfully.');
  };

  // ----------------------------------------------------
  // DAILY CHALLENGE START
  // ----------------------------------------------------
  const handleStartDailyChallenge = () => {
    sounds.playClick();

    // If user is not logged in, prompt modal!
    if (!user) {
      setShowSignInModal(true);
      return;
    }

    launchDailyGame();
  };

  const launchDailyGame = () => {
    setGameModeType('DAILY_QUEST');
    const board = generateDailyChallengeBoard(todayDateStr);
    setDailyBoardData(board);
    setActiveChallenges(board.challenges);
    
    const uid = user ? user.uid : 'guest';
    const alreadyDone = user ? firebaseService.hasCompletedOfficialRun(uid, todayDateStr) : false;
    setIsOfficialAttempt(!alreadyDone);

    setCurrentScore(0);
    setScoredWords([]);
    setCurrentInput('');
    setTimeLeft(120);
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
        if (prev <= 10) {
          sounds.playTick(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [playState, currentScore]);

  // Round Over Trigger
  const handleRoundFinished = async () => {
    sounds.playWhistle();
    setPlayState('GAME_OVER');
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });

    // Record score if Daily Quest & Official Run
    if (gameModeType === 'DAILY_QUEST' && isOfficialAttempt && user) {
      const best = myBestWord.word !== '—' ? myBestWord.word : 'NONE';
      await firebaseService.submitDailyScore(todayDateStr, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        score: currentScore,
        wordCount: scoredWords.length,
        bestWord: best,
        timestamp: Date.now()
      });
      setHasCompletedToday(true);
      setPreviousDailyScore(currentScore);
      loadLeaderboard(todayDateStr);
    }

    // If Host in P2P mode, broadcast END_GAME
    if (gameModeType === 'PARTY_RUSH' && p2pMode === 'HOST') {
      p2pManagerRef.current?.broadcast({
        type: 'END_GAME',
        payload: { leaderboard: liveLeaderboard }
      });
    }
  };

  // ----------------------------------------------------
  // WORD SUBMISSION & SCORING
  // ----------------------------------------------------
  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (playState !== 'PLAYING' || isEvaluatingWord) return;

    const candidate = currentInput.trim().toUpperCase();
    if (!candidate) return;

    setIsEvaluatingWord(true);
    try {
      const existingWords = scoredWords.map(w => w.word);
      const result: WordSprintScore = await evaluateWordRush(candidate, activeChallenges, existingWords);

      if (!result.valid) {
        sounds.playError();
        triggerInputShake(result.reason || 'Invalid word!');
        return;
      }

      sounds.playSuccess();

    const newScore = currentScore + result.totalScore;
    const newEntry: ScoredWordEntry = {
      word: result.word,
      baseScore: result.baseScore,
      bonusScore: result.bonusScore,
      totalScore: result.totalScore,
      matchedChallengeTitles: result.matchedChallengeTitles,
      timestamp: Date.now()
    };

    const updatedWords = [newEntry, ...scoredWords];
    setCurrentScore(newScore);
    setScoredWords(updatedWords);
    setCurrentInput('');

    const bonusText = result.bonusScore > 0 ? ` (+${result.bonusScore} Match Bonus!)` : '';
    triggerInputSuccess(`+${result.totalScore} pts!${bonusText}`);

    // Update multiplayer score if playing Party Rush
    if (gameModeType === 'PARTY_RUSH') {
      const bestScored = [...updatedWords].sort((a, b) => b.totalScore - a.totalScore)[0];
      if (p2pMode === 'GUEST') {
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
      } else if (p2pMode === 'HOST') {
        updateHostLeaderboard(myPlayerId, newScore, updatedWords.length, bestScored.word, bestScored.totalScore);
      }
    }
    } finally {
      setIsEvaluatingWord(false);
      setTimeout(() => wordInputRef.current?.focus(), 40);
    }
  };

  const triggerInputShake = (msg: string) => {
    setInputFeedback({ message: msg, isError: true });
    setShakingInput(true);
    setTimeout(() => setShakingInput(false), 300);
    setTimeout(() => {
      setInputFeedback(prev => (prev?.message === msg ? null : prev));
    }, 3500);
  };

  const triggerInputSuccess = (msg: string) => {
    setInputFeedback({ message: msg, isError: false });
    setTimeout(() => {
      setInputFeedback(prev => (prev?.message === msg ? null : prev));
    }, 2200);
  };

  // ----------------------------------------------------
  // MULTIPLAYER (P2P WEBRTC ROOMS)
  // ----------------------------------------------------
  const handleHostCreateRoom = async () => {
    sounds.playClick();
    const code = generateRoomCode();
    setRoomCode(code);
    setP2PStatus('Creating WebRTC room...');
    setP2PMode('HOST');
    setIsGuestConnected(false);
    setGameModeType('PARTY_RUSH');
    setActiveTab('PARTY_RUSH');
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
        name: `${user?.displayName || playerName} (Host)`,
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
      triggerInputShake('Network issue. Try again or play Daily Quest!');
    }
  };

  const handleLeaveRoom = () => {
    sounds.playClick();
    p2pManagerRef.current?.destroy();
    p2pManagerRef.current = null;
    setP2PMode('IDLE');
    setIsGuestConnected(false);
    setP2PStatus('');
    setPlayers([]);
    setLiveLeaderboard([]);
  };

  const handleP2PHostMessage = (msg: NetworkMessage) => {
    if (msg.type === 'JOIN_REQUEST') {
      sounds.playClick();
      const guestId = msg.payload.id || msg.senderId || `guest_${Date.now()}`;
      const guestName = msg.payload.name || `Player ${players.length + 1}`;
      const guestAvatar = msg.payload.avatar || '🐼';

      setPlayers(prev => {
        const existingIdx = prev.findIndex(p => p.id === guestId);
        let updated: Player[];
        if (existingIdx >= 0) {
          // Deduplicate: update existing player entry rather than duplicating
          updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            name: guestName,
            avatar: guestAvatar
          };
        } else {
          if (prev.length >= 12) return prev;
          const newPlayer: Player = {
            id: guestId,
            name: guestName,
            avatar: guestAvatar,
            isHost: false,
            score: 0,
            wordCount: 0,
            bestWord: '—',
            bestWordPoints: 0
          };
          updated = [...prev, newPlayer];
        }

        // Send explicit handshake confirmation directly back to the connecting guest
        p2pManagerRef.current?.sendToPeer(guestId, {
          type: 'JOIN_ACCEPTED',
          payload: {
            roomCode,
            players: updated
          }
        });

        // Broadcast updated roster to all other players in the room
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

      const ranked: LeaderboardEntry[] = [...updated]
        .sort((a, b) => b.score - a.score || b.wordCount - a.wordCount)
        .map((p, idx) => ({ ...p, rank: idx + 1 }));

      setLiveLeaderboard(ranked);

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
    setP2PMode('GUEST');
    setIsGuestConnected(false);
    setGameModeType('PARTY_RUSH');
    setActiveTab('PARTY_RUSH');
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
      await manager.joinRoom(code, user?.displayName || playerName, playerAvatar);
      setMyPlayerId(manager.myPeerId);
    } catch (err: any) {
      triggerInputShake('Could not connect. Verify room code or host status.');
    }
  };

  const handleP2PGuestMessage = (msg: NetworkMessage) => {
    if (msg.type === 'JOIN_ACCEPTED') {
      sounds.playSuccess();
      setIsGuestConnected(true);
      if (msg.payload.roomCode) setRoomCode(msg.payload.roomCode);
      if (msg.payload.players) {
        setPlayers(msg.payload.players);
        setLiveLeaderboard(msg.payload.players);
      }
      setP2PStatus('Joined room! Waiting for host...');
      triggerInputSuccess('Connected to party room!');
    } else if (msg.type === 'PLAYER_LIST_UPDATE') {
      setIsGuestConnected(true);
      if (msg.payload.players) {
        setPlayers(msg.payload.players);
        setLiveLeaderboard(msg.payload.players);
      }
    } else if (msg.type === 'START_GAME') {
      sounds.playSuccess();
      setActiveChallenges(msg.payload.challenges);
      setTimeLeft(msg.payload.duration || 120);
      setCurrentScore(0);
      setScoredWords([]);
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

  const handleHostStartGame = () => {
    sounds.playClick();
    const newChallenges = generateSharedChallengeBoard();
    setActiveChallenges(newChallenges);
    setCurrentScore(0);
    setScoredWords([]);
    setCurrentInput('');
    setTimeLeft(120);

    const resetPlayers = players.map(p => ({
      ...p,
      score: 0,
      wordCount: 0,
      bestWord: '—',
      bestWordPoints: 0
    }));
    setPlayers(resetPlayers);
    setLiveLeaderboard(resetPlayers);

    p2pManagerRef.current?.broadcast({
      type: 'START_GAME',
      payload: {
        challenges: newChallenges,
        duration: 120
      }
    });

    setPlayState('PLAYING');
    setTimeout(() => wordInputRef.current?.focus(), 150);
  };

  const inspectWord = (word: string) => {
    sounds.playClick();
    const def = getWordDefinition(word);
    setShowDefinitionModal(def);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const copyRoomCode = () => {
    navigator.clipboard?.writeText(roomCode);
    sounds.playClick();
    triggerInputSuccess(`Room code ${roomCode} copied!`);
  };

  return (
    <div className="min-h-screen bg-[#0b101d] text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      
      {/* ======================================================== */}
      {/* 1. TOP BAR NAVIGATION */}
      {/* ======================================================== */}
      <header className="w-full bg-[#111728]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-2.5 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          
          {/* Brand */}
          <button 
            onClick={() => {
              sounds.playClick();
              setActiveTab('HOME');
              setPlayState('LOBBY');
            }}
            className="flex items-center gap-2 group cursor-pointer shrink-0 focus-visible:outline-none"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 text-white animate-spark" />
            </div>
            <div className="text-left">
              <span className="font-display font-extrabold text-base sm:text-lg tracking-tight text-white block leading-none">
                WordSpark
              </span>
              <span className="text-[10px] font-semibold text-amber-400 tracking-wider uppercase">
                Brainy English Party
              </span>
            </div>
          </button>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-[#0b101d] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('HOME');
                setPlayState('LOBBY');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'HOME' && playState === 'LOBBY'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Daily Challenge</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('PARTY_RUSH');
                setP2PMode('IDLE');
                setPlayState('LOBBY');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'PARTY_RUSH' 
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Party Rush (1-12P)</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                setSelectedRankingDate(todayDateStr);
                setActiveTab('DAILY_RANKINGS');
                setPlayState('LOBBY');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'DAILY_RANKINGS' 
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Daily Rankings</span>
            </button>
          </nav>

          {/* User Profile & Auth Button */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              /* Signed in State: Avatar + Name + Sign out button */
              <div className="flex items-center gap-2 bg-[#0e1424] border border-slate-800 rounded-xl px-2.5 py-1">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName} 
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full border border-amber-400/60 object-cover shrink-0" 
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold text-white max-w-[90px] sm:max-w-[130px] truncate">
                  {user.displayName}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              /* Not Signed In: Sign in with Google Button */
              <button
                onClick={handleDirectGoogleSignIn}
                disabled={isSigningIn}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                {isSigningIn ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>
            )}

            <button
              onClick={handleToggleMute}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>

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
      {/* 2. MAIN APPLICATION WORKSPACE */}
      {/* ======================================================== */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 flex flex-col justify-center">

        {/* ---------------------------------------------------- */}
        {/* VIEW 1: HOME SCREEN (FEATURE CARDS) */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'HOME' && playState === 'LOBBY' && (
          <div className="flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 my-auto">
            {/* Hero Lockup */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-3 animate-bomb-pulse">
                <Flame className="w-12 h-12 text-white animate-spark" />
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-white">
                Word<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">Spark</span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mt-2">
                Brainy English Party: Daily Google-authenticated quest, live Firestore rankings, and 12-player simultaneous rush!
              </p>

              {/* Midnight countdown teaser pill */}
              <div className="mt-3 inline-flex items-center gap-2 bg-[#141c30] border border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-semibold text-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Today: {todayDateStr} · Daily Reset in {timeUntilReset}</span>
              </div>
            </div>

            {/* MAIN 3 GAME MODE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl text-left">
              
              {/* CARD 1: DAILY CHALLENGE (Replaced Solo Sprint) */}
              <div className="bg-[#141c30] border border-amber-500/40 hover:border-amber-400 rounded-3xl p-5 flex flex-col justify-between group transition-all duration-200 hover:-translate-y-1 shadow-xl hover:shadow-amber-500/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[9px] uppercase px-2.5 py-0.5 rounded-bl-xl tracking-wider">
                  Official Quest
                </div>

                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400 group-hover:scale-110 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-white">Daily Challenge</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Same 4 prompts globally each date. 120-sec sprint with 1 official ranked score per day logged to Firestore!
                  </p>

                  {/* Seeded Board Mini Indicators */}
                  <div className="mt-3 bg-[#0d1322] p-2.5 rounded-xl border border-slate-800 space-y-1 text-[11px]">
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-500">Topic:</span>
                      <span className="text-emerald-400 font-bold">{dailyBoardData.targetCategory}</span>
                    </div>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-500">Bonus Letter:</span>
                      <span className="text-amber-400 font-bold">"{dailyBoardData.bonusLetter}" (+20 pts)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {hasCompletedToday ? (
                    <div className="text-[11px] text-emerald-400 font-bold mb-1.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Today's Score: {previousDailyScore || 0} pts</span>
                    </div>
                  ) : !user ? (
                    <div className="text-[10px] text-amber-300/80 font-medium mb-1.5 flex items-center gap-1">
                      <LogIn className="w-3 h-3 text-amber-400" />
                      <span>Sign in required to record rank</span>
                    </div>
                  ) : null}

                  <button
                    onClick={handleStartDailyChallenge}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer active:translate-y-0.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{hasCompletedToday ? 'Practice Today\'s Quest' : 'Play Daily Challenge'}</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: PARTY RUSH (Multiplayer 1-12 Players) */}
              <div className="bg-[#141c30] border border-slate-800 hover:border-cyan-500/60 rounded-3xl p-5 flex flex-col justify-between group transition-all duration-200 hover:-translate-y-1 shadow-xl hover:shadow-cyan-500/10">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-3 text-cyan-400 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-white">Party Word Rush</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    1 to 12 players simultaneous clash! Connect via 4-letter room code. Zero wait time, live leaderboard every second.
                  </p>

                  <div className="mt-3 bg-[#0d1322] p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div>• 120s Shared Bomb Timer</div>
                    <div>• Instant Local Scoring</div>
                    <div>• Real-time Synced Roster</div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleHostCreateRoom}
                    className="flex-1 py-2.5 px-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider text-center cursor-pointer active:translate-y-0.5 shadow-md shadow-cyan-500/20"
                  >
                    Host Room
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('PARTY_RUSH');
                      setP2PMode('GUEST');
                    }}
                    className="flex-1 py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs uppercase tracking-wider text-center cursor-pointer active:translate-y-0.5"
                  >
                    Join
                  </button>
                </div>
              </div>

              {/* CARD 3: DAILY RANKINGS (Global Firestore Leaderboard) */}
              <div className="bg-[#141c30] border border-slate-800 hover:border-orange-500/60 rounded-3xl p-5 flex flex-col justify-between group transition-all duration-200 hover:-translate-y-1 shadow-xl hover:shadow-orange-500/10">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-3 text-orange-400 group-hover:scale-110 transition-transform">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-white">Daily Rankings</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Live cloud leaderboard powered by Firestore. View Top 50 global champions for {todayDateStr}.
                  </p>

                  {/* Leaderboard preview snapshot */}
                  <div className="mt-3 bg-[#0d1322] p-2.5 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                    {dailyLeaderboard.slice(0, 2).map((entry, idx) => (
                      <div key={entry.uid} className="flex items-center justify-between">
                        <span className="text-slate-300 font-semibold truncate max-w-[100px]">
                          {idx === 0 ? '🥇' : '🥈'} {entry.displayName}
                        </span>
                        <span className="font-display font-bold text-amber-400">{entry.score} pts</span>
                      </div>
                    ))}
                    {dailyLeaderboard.length === 0 && (
                      <div className="text-slate-500 text-[10px] italic">Be the first to score today!</div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSelectedRankingDate(todayDateStr);
                      setActiveTab('DAILY_RANKINGS');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-display font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer active:translate-y-0.5"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>View Rankings</span>
                  </button>
                </div>
              </div>

            </div>

            {/* SPONSOR BANNER */}
            <div className="pt-2">
              <AdBanner />
            </div>

            {/* Quick Lexicon Search & Rules bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 pt-2">
              <button
                onClick={() => setShowRulesModal(true)}
                className="hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>How to Play</span>
              </button>
              <span>·</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <BookOpen className="w-3.5 h-3.5" />
                <span>3,500+ Verified English Nouns</span>
              </span>
              <span>·</span>
              <span className="text-amber-400 font-medium">
                Nouns Only · 3-4 letters: 10p · 5-6: 25p · 7+: 50p
              </span>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 2: ACTIVE PLAYFIELD (DAILY QUEST & MULTIPLAYER) */}
        {/* ---------------------------------------------------- */}
        {playState === 'PLAYING' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Header Status Strip */}
            <div className="bg-[#141c30] border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {gameModeType === 'DAILY_QUEST' ? (isOfficialAttempt ? '★ Official Daily Run' : 'Practice Run') : 'Your Score'}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-display font-black text-amber-400 tabular-nums">
                    {currentScore}
                  </span>
                  <span className="text-xs font-bold text-slate-400">pts</span>
                </div>
              </div>

              {/* 120s Countdown Timer */}
              <div className="text-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Timer</span>
                <div className={`flex items-center justify-center gap-1 font-display text-3xl sm:text-4xl font-black tabular-nums ${
                  timeLeft <= 10 ? 'text-rose-500 animate-pulse' : timeLeft <= 30 ? 'text-orange-400' : 'text-emerald-400'
                }`}>
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>

              {/* Words Count */}
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Words</span>
                <span className="text-2xl sm:text-3xl font-display font-bold text-cyan-400 tabular-nums">
                  {scoredWords.length}
                </span>
              </div>
            </div>

            {/* Multiplayer Live Scoreboard Mini Strip (If in Party Rush) */}
            {gameModeType === 'PARTY_RUSH' && liveLeaderboard.length > 0 && (
              <div className="bg-[#0e1526] border border-cyan-500/30 rounded-2xl p-3 shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2 px-1">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Live Rush Ranking
                  </span>
                  <span className="text-slate-400 font-normal">Syncing every word</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {liveLeaderboard.slice(0, 4).map((entry, idx) => (
                    <div 
                      key={entry.id}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                        entry.id === myPlayerId ? 'bg-cyan-500/20 border border-cyan-500/50 text-white font-bold' : 'bg-[#141c30] border border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-4 text-center font-bold text-amber-400">#{idx + 1}</span>
                        <span>{entry.avatar}</span>
                        <span className="truncate max-w-[70px]">{entry.name}</span>
                      </div>
                      <span className="font-display font-bold text-amber-400 tabular-nums">
                        {entry.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SHARED CHALLENGE BOARD */}
            <div className="bg-[#101726] border border-slate-800/90 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Board Prompts (+20 Bonus Pts Each)
                </span>
                <span className="text-[10px] text-slate-400">
                  {gameModeType === 'DAILY_QUEST' ? `Daily Quest · ${todayDateStr}` : 'Party Board'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {activeChallenges.map(c => (
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

            {/* WORD INPUT & SUBMIT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rule: English NOUNS only!</span>
                </span>
                <span className="text-[10px] text-slate-400">Verbs & Adjectives rejected</span>
              </div>
              <form onSubmit={handleWordSubmit} className="flex gap-2">
                <input
                  ref={wordInputRef}
                  type="text"
                  value={currentInput}
                  onChange={e => setCurrentInput(e.target.value.toUpperCase())}
                  placeholder="Type an English NOUN and press Enter..."
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isEvaluatingWord}
                  className={`flex-1 bg-[#141c30] border-2 ${
                    shakingInput ? 'border-rose-500 animate-shake shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/50' : 'border-slate-700 focus:border-amber-400'
                  } text-white text-base sm:text-xl font-bold px-4 py-3 rounded-2xl outline-none transition-colors tracking-widest placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm`}
                />
                <button
                  type="submit"
                  disabled={isEvaluatingWord}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 font-display font-extrabold text-sm sm:text-base px-6 py-3 rounded-2xl cursor-pointer shadow-lg shadow-orange-500/20 active:translate-y-0.5 flex items-center gap-1.5 shrink-0"
                >
                  {isEvaluatingWord && <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />}
                  <span>{isEvaluatingWord ? 'Checking...' : 'Score!'}</span>
                </button>
              </form>
            </div>

            {/* SCORED WORDS LIST */}
            <div className="bg-[#101726] border border-slate-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Scored Words ({scoredWords.length}) · Tap to view definition
                </span>
                <span className="text-xs text-amber-400 font-medium">
                  Best: {myBestWord.word} ({myBestWord.totalScore} pts)
                </span>
              </div>

              {scoredWords.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs italic">
                  No words scored yet. Type any valid 3+ letter English word matching the board!
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {scoredWords.map((item, idx) => (
                    <button
                      key={`${item.word}-${idx}`}
                      onClick={() => inspectWord(item.word)}
                      className="group bg-[#162035] hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span className="text-white group-hover:text-amber-300">{item.word}</span>
                      <span className="text-[10px] text-amber-400 tabular-nums">+{item.totalScore}</span>
                      {item.matchedChallengeTitles.length > 0 && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded">
                          ★ bonus
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
        {/* VIEW 3: GAME OVER & SUMMARY */}
        {/* ---------------------------------------------------- */}
        {playState === 'GAME_OVER' && (
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto space-y-6 shadow-2xl">
            <div className="text-center">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">120s Round Complete</span>
              <h2 className="text-3xl font-display font-black text-white mt-1">
                {gameModeType === 'DAILY_QUEST' ? 'Daily Quest Complete!' : 'Vocabulary Sprint Podium'}
              </h2>
            </div>

            {/* Score Summary Box */}
            <div className="grid grid-cols-3 gap-3 bg-[#0d1322] p-4 rounded-2xl border border-slate-800 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Final Score</span>
                <span className="text-2xl font-display font-extrabold text-amber-400 tabular-nums">{currentScore} pts</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Words Found</span>
                <span className="text-2xl font-display font-extrabold text-cyan-400 tabular-nums">{scoredWords.length}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Best Word</span>
                <span className="text-lg font-display font-bold text-emerald-400 truncate block">{myBestWord.word}</span>
              </div>
            </div>

            {/* Daily Quest Cloud Confirmation */}
            {gameModeType === 'DAILY_QUEST' && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <span className="font-bold text-emerald-300 text-sm block">
                  {isOfficialAttempt ? 'Official Daily Score Submitted to Firestore!' : 'Practice Run Completed!'}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Check your position on the Global Daily Leaderboard for {todayDateStr}.
                </p>
              </div>
            )}

            {/* Word Breakdown */}
            {scoredWords.length > 0 && (
              <div className="text-left">
                <span className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Your Played Words (Tap to inspect definitions):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {scoredWords.map(w => (
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

            {/* SPONSOR BANNER */}
            <AdBanner compact />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {gameModeType === 'DAILY_QUEST' ? (
                <>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSelectedRankingDate(todayDateStr);
                      setActiveTab('DAILY_RANKINGS');
                      setPlayState('LOBBY');
                    }}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                  >
                    View Global Rankings
                  </button>
                  <button
                    onClick={launchDailyGame}
                    className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Practice Again
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setActiveTab('PARTY_RUSH');
                    setPlayState('LOBBY');
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  Return to Party Lobby
                </button>
              )}
              <button
                onClick={() => {
                  sounds.playClick();
                  if (p2pMode !== 'IDLE') handleLeaveRoom();
                  setActiveTab('HOME');
                  setPlayState('LOBBY');
                }}
                className="py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Home className="w-4 h-4 text-amber-400" />
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 4: MULTIPLAYER PARTY RUSH LOBBY */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'PARTY_RUSH' && playState === 'LOBBY' && (
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg mx-auto space-y-6 shadow-2xl">
            {/* Top Bar Return to Home */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <button
                onClick={() => {
                  sounds.playClick();
                  handleLeaveRoom();
                  setActiveTab('HOME');
                  setPlayState('LOBBY');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </button>
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                Party Rush
              </span>
            </div>

            <div className="text-center">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Simultaneous Multiplayer</span>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">Party Word Rush</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Up to 12 players simultaneously. Everyone races against the same 120s timer on their own phone or laptop!
              </p>
            </div>

            {/* Profile Avatar & Nickname */}
            <div className="bg-[#0b101d] p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  const cur = AVATAR_OPTIONS.indexOf(playerAvatar);
                  setPlayerAvatar(AVATAR_OPTIONS[(cur + 1) % AVATAR_OPTIONS.length]);
                }}
                className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0 cursor-pointer"
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
                  className="w-full bg-transparent border-none text-white font-bold text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Mode: Idle / Host / Guest */}
            {p2pMode === 'IDLE' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleHostCreateRoom}
                  className="py-4 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20 active:translate-y-0.5"
                >
                  Create Room (Host)
                </button>
                <button
                  onClick={() => setP2PMode('GUEST')}
                  className="py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  Join with Code
                </button>
              </div>
            )}

            {/* HOST VIEW */}
            {p2pMode === 'HOST' && (
              <div className="space-y-4">
                <div className="bg-[#0b101d] border-2 border-cyan-500/40 rounded-2xl p-4 text-center">
                  <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-widest block mb-1">Room Code</span>
                  <span className="text-4xl font-display font-black tracking-widest text-white">
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
                    <span>Joined Players ({players.length}/12)</span>
                    <span>{p2pStatus}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {players.map(p => (
                      <div key={p.id} className="bg-[#0e1424] p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                        <span className="text-lg">{p.avatar}</span>
                        <span className="text-xs font-bold text-white truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleHostStartGame}
                    className="flex-1 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20 active:translate-y-0.5"
                  >
                    Start 120s Simultaneous Sprint!
                  </button>
                  <button
                    onClick={handleLeaveRoom}
                    className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* GUEST VIEW */}
            {p2pMode === 'GUEST' && (
              <>
                {isGuestConnected ? (
                  /* GUEST CONNECTED LOBBY VIEW */
                  <div className="space-y-4">
                    <div className="bg-[#0b101d] border-2 border-cyan-500/40 rounded-2xl p-4 text-center">
                      <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-widest block mb-1">Connected Room Code</span>
                      <span className="text-4xl font-display font-black tracking-widest text-white">
                        {roomCode}
                      </span>
                      <button
                        onClick={copyRoomCode}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy Code
                      </button>
                    </div>

                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2 text-cyan-300 font-bold text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                        <span>Waiting for host to start sprint...</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        All players race simultaneously when the host clicks Start.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2 px-1">
                        <span>Joined Players ({players.length}/12)</span>
                        <span className="text-emerald-400 font-medium">Ready in Room</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {players.map(p => (
                          <div key={p.id} className="bg-[#0e1424] p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                            <span className="text-lg">{p.avatar}</span>
                            <span className="text-xs font-bold text-white truncate">
                              {p.name} {p.id === myPlayerId && '(You)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleLeaveRoom}
                      className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-rose-950/60 hover:border-rose-500/50 border border-slate-700 text-rose-300 font-bold text-xs cursor-pointer active:translate-y-0.5 transition-colors"
                    >
                      Leave Room
                    </button>
                  </div>
                ) : (
                  /* GUEST CONNECTING / ENTER CODE FORM */
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Enter 4-Letter Room Code
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={joinCodeInput}
                        onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                        placeholder="ROOM CODE"
                        disabled={p2pStatus.includes('Connecting')}
                        className="w-full text-center text-3xl font-display font-black tracking-widest bg-[#0b101d] border-2 border-slate-700 focus:border-cyan-400 rounded-2xl p-3 text-white uppercase outline-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleGuestJoinRoom}
                        disabled={p2pStatus.includes('Connecting')}
                        className="flex-1 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20 active:translate-y-0.5 flex items-center justify-center gap-2"
                      >
                        {p2pStatus.includes('Connecting') && <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>{p2pStatus.includes('Connecting') ? 'Connecting...' : 'Connect & Join'}</span>
                      </button>
                      <button
                        onClick={handleLeaveRoom}
                        className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    {p2pStatus && (
                      <p className="text-center text-xs text-cyan-300 font-semibold animate-pulse">{p2pStatus}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 5: DAILY RANKINGS (FIRESTORE CLOUD LEADERBOARD) */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'DAILY_RANKINGS' && playState === 'LOBBY' && (
          <div className="bg-[#141c30] border border-slate-800 rounded-3xl p-4 sm:p-7 max-w-3xl mx-auto space-y-5 shadow-2xl">
            {/* Top Bar Return to Home */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <button
                onClick={() => {
                  sounds.playClick();
                  setActiveTab('HOME');
                  setPlayState('LOBBY');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </button>
              <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Leaderboard
              </span>
            </div>

            {/* Header & Date Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Global Daily Leaderboard
                </span>
                <h2 className="text-2xl font-display font-extrabold text-white mt-0.5">
                  Daily Word Champions
                </h2>
              </div>

              {/* Date Switcher */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedRankingDate}
                  onChange={e => setSelectedRankingDate(e.target.value)}
                  className="bg-[#0b101d] border border-slate-700 focus:border-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl outline-none"
                />
                <button
                  onClick={() => loadLeaderboard(selectedRankingDate)}
                  disabled={isLoadingLeaderboard}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  title="Refresh Leaderboard"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLeaderboard ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* PINNED USER RANK (IF SIGNED IN & PLAYED) */}
            {user && (
              <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border-2 border-amber-500/60 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center font-display text-sm">
                    {myLeaderboardEntry ? `#${myLeaderboardEntry.rank}` : '—'}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {user.displayName} (You)
                      {myLeaderboardEntry && <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded font-normal">Ranked</span>}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {myLeaderboardEntry 
                        ? `Best: ${myLeaderboardEntry.bestWord} · ${myLeaderboardEntry.wordCount} words` 
                        : hasCompletedToday ? 'Score saved to device' : 'No official attempt logged for this date'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-display font-black text-amber-400 tabular-nums">
                    {myLeaderboardEntry ? `${myLeaderboardEntry.score} pts` : '0 pts'}
                  </span>
                </div>
              </div>
            )}

            {/* PODIUM OF TOP PLAYERS */}
            {dailyLeaderboard.length > 0 && (
              <div className={`grid ${
                dailyLeaderboard.length === 1 
                  ? 'grid-cols-1 max-w-xs mx-auto' 
                  : dailyLeaderboard.length === 2 
                    ? 'grid-cols-2 max-w-md mx-auto' 
                    : 'grid-cols-3'
              } gap-2 items-end pt-2 pb-2 text-center`}>
                {/* 2nd Place Silver (if >= 2 players) */}
                {dailyLeaderboard.length >= 2 && (
                  <div className={`bg-[#0e1424] p-3 rounded-2xl border border-slate-700/80 flex flex-col items-center ${
                    dailyLeaderboard.length >= 3 ? 'order-1' : 'order-2'
                  }`}>
                    <span className="text-xl mb-1">🥈</span>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-full">
                      {dailyLeaderboard[1].displayName}
                    </span>
                    <span className="text-base font-display font-black text-slate-300 mt-0.5">
                      {dailyLeaderboard[1].score} pts
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
                      Best: {dailyLeaderboard[1].bestWord}
                    </span>
                  </div>
                )}

                {/* 1st Place Gold */}
                <div className={`bg-gradient-to-b from-amber-500/20 to-orange-500/10 p-3.5 rounded-2xl border-2 border-amber-500 shadow-xl flex flex-col items-center -translate-y-2 ${
                  dailyLeaderboard.length >= 3 ? 'order-2' : 'order-1'
                }`}>
                  <span className="text-2xl mb-1">🥇</span>
                  <span className="text-xs sm:text-sm font-black text-white truncate max-w-full">
                    {dailyLeaderboard[0].displayName}
                  </span>
                  <span className="text-xl font-display font-black text-amber-400 mt-0.5">
                    {dailyLeaderboard[0].score} pts
                  </span>
                  <span className="text-[9px] bg-amber-500 text-slate-950 font-extrabold px-2 py-0.2 rounded-full uppercase mt-1">
                    Daily Leader
                  </span>
                </div>

                {/* 3rd Place Bronze (if >= 3 players) */}
                {dailyLeaderboard.length >= 3 && (
                  <div className="bg-[#0e1424] p-3 rounded-2xl border border-slate-700/80 flex flex-col items-center order-3">
                    <span className="text-xl mb-1">🥉</span>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-full">
                      {dailyLeaderboard[2].displayName}
                    </span>
                    <span className="text-base font-display font-black text-amber-600 mt-0.5">
                      {dailyLeaderboard[2].score} pts
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
                      Best: {dailyLeaderboard[2].bestWord}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* FULL TOP 50 TABLE */}
            <div className="bg-[#0d1322] rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Player & Ranking</span>
                <span>Best Word · Score</span>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                {dailyLeaderboard.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    {isLoadingLeaderboard ? 'Loading Daily Scores from Firestore...' : 'No official scores recorded for this date yet. Be the first to play!'}
                  </div>
                ) : (
                  dailyLeaderboard.map((entry) => (
                    <div 
                      key={entry.uid} 
                      className={`px-4 py-2.5 flex items-center justify-between text-xs transition-colors ${
                        entry.isMe ? 'bg-amber-500/10 font-bold' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`w-5 text-center font-bold ${
                          entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-slate-300' : entry.rank === 3 ? 'text-amber-600' : 'text-slate-500'
                        }`}>
                          #{entry.rank}
                        </span>
                        {entry.photoURL ? (
                          <img 
                            src={entry.photoURL} 
                            alt={entry.displayName} 
                            referrerPolicy="no-referrer"
                            className="w-5 h-5 rounded-full object-cover shrink-0" 
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-bold text-slate-400 shrink-0">
                            {entry.displayName.charAt(0)}
                          </div>
                        )}
                        <span className="text-white truncate max-w-[120px] sm:max-w-[180px]">
                          {entry.displayName} {entry.isMe && '(You)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <span className="text-slate-400 text-[11px] hidden sm:inline">
                          Best: <span className="text-emerald-400 font-semibold">{entry.bestWord}</span>
                        </span>
                        <span className="font-display font-extrabold text-amber-400 tabular-nums">
                          {entry.score} pts
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Play CTA */}
            <button
              onClick={handleStartDailyChallenge}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 active:translate-y-0.5"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{hasCompletedToday ? 'Practice Today\'s Challenge' : 'Play Today\'s Challenge'}</span>
            </button>

            {/* SPONSOR BANNER IN RANKINGS */}
            <AdBanner compact />
          </div>
        )}

      </main>

      {/* FLOATING TOAST / FEEDBACK BANNER */}
      {inputFeedback && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 pointer-events-auto backdrop-blur-md ${
            inputFeedback.isError 
              ? 'bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-rose-950/50' 
              : 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/50'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {inputFeedback.isError ? (
                <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <span className="text-xs sm:text-sm font-bold leading-snug break-words">
                {inputFeedback.message}
              </span>
            </div>
            <button
              onClick={() => setInputFeedback(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="w-full py-3 px-4 border-t border-slate-800/80 bg-[#0d1322] text-center text-xs text-slate-500 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>WordSpark: Brainy English Party · Deterministic Daily Quest · Firestore Global Rankings</span>
        {isOwnerAdmin && (
          <>
            <span>·</span>
            <button
              onClick={() => {
                sounds.playClick();
                setShowAffiliateModal(true);
              }}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
              title="Configure custom affiliate links and view earnings analytics (Visible only to Admin/Owner)"
            >
              Affiliate & Sponsor Setup ⚡ (Admin)
            </button>
          </>
        )}
      </footer>

      {/* ======================================================== */}
      {/* 3. MODALS */}
      {/* ======================================================== */}

      {/* SIGN IN WITH GOOGLE / AUTH PROMPT MODAL */}
      {showSignInModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141c30] border border-amber-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setShowSignInModal(false);
                setAuthErrorDetail(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                Player Sign-In & Rankings
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Sign in with Google or create an instant player profile to log your Daily Challenge score to the global leaderboard.
              </p>
            </div>

            {/* Diagnostic Alert Banner if Auth Issue Occurred */}
            {authErrorDetail && (
              <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-3.5 text-left text-xs space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{authErrorDetail.title}</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {authErrorDetail.message}
                </p>
                {authErrorDetail.domain && (
                  <div className="bg-[#0b101d] p-2 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] gap-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0">Domain:</span>
                    <code className="text-amber-400 font-mono text-[10px] truncate flex-1">{authErrorDetail.domain}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(authErrorDetail.domain || '');
                        triggerInputSuccess('Domain copied! Add to Firebase Authorized Domains.');
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 pt-1">
              {/* Google Sign In Button */}
              <button
                onClick={handleDirectGoogleSignIn}
                disabled={isSigningIn}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:translate-y-0.5 transition-all"
              >
                {isSigningIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>

              {/* Instant Account Profile Setup */}
              <div className="bg-[#0e1424] p-3 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Instant Player Account
                  </span>
                  <span className="text-slate-500 font-normal">Works offline & in iframe</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-base shrink-0 border border-slate-700">
                    🐼
                  </div>
                  <input
                    type="text"
                    maxLength={16}
                    value={customAccountName}
                    onChange={e => setCustomAccountName(e.target.value)}
                    placeholder="Enter your nickname..."
                    className="flex-1 bg-[#0b101d] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    handleInstantSignIn(customAccountName);
                    launchDailyGame();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:translate-y-0.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play as {customAccountName.trim() || 'Player'}</span>
                </button>
              </div>

              {/* Guest / Unranked Practice */}
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowSignInModal(false);
                  setAuthErrorDetail(null);
                  launchDailyGame();
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-400 py-1 cursor-pointer"
              >
                Practice as Guest (Scores not recorded)
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141c30] border border-slate-700/80 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowRulesModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-amber-400" /> How to Play WordSpark
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Fast-paced vocabulary rush for solo wordsmiths and multiplayer party rooms.
              </p>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {/* Rule 1: English Nouns Only */}
              <div className="bg-[#0d1322] p-3.5 rounded-2xl border border-amber-500/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Strict Rule: Valid English NOUNS Only</span>
                </div>
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  Every submitted word must be a verified English <strong>NOUN</strong> (person, place, thing, animal, or abstract concept).
                </p>
                <div className="bg-[#101728] p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1">
                  <p className="text-emerald-300">
                    <span className="font-bold">✓ Accepted:</span> PLANET, CASTLE, HARMONY, COFFEE, GALAXY, TIGER
                  </p>
                  <p className="text-cyan-300">
                    <span className="font-bold">✓ Plurals:</span> CITIES, TREES, CHILDREN, WOLVES, HEROES
                  </p>
                  <p className="text-rose-300">
                    <span className="font-bold">✗ Rejected:</span> Verbs (RUN, FLY), Adjectives (FAST, BRAVE), Adverbs (QUICKLY), and Prepositions (UNDER)
                  </p>
                </div>
              </div>

              {/* Rule 2: Scoring Breakdown */}
              <div className="bg-[#0d1322] p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-orange-400 text-sm">
                  <Award className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Point Scoring System</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#121a2c] p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">3–4 Letters</span>
                    <span className="font-display font-extrabold text-amber-400 text-sm">10 pts</span>
                    <span className="text-[9px] text-slate-500 block">CAT, BIRD</span>
                  </div>
                  <div className="bg-[#121a2c] p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">5–6 Letters</span>
                    <span className="font-display font-extrabold text-amber-400 text-sm">25 pts</span>
                    <span className="text-[9px] text-slate-500 block">PLANET, BRIDGE</span>
                  </div>
                  <div className="bg-[#121a2c] p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">7+ Letters</span>
                    <span className="font-display font-extrabold text-amber-400 text-sm">50 pts</span>
                    <span className="text-[9px] text-slate-500 block">ELEPHANT, CASTLE</span>
                  </div>
                </div>
                <div className="bg-[#121a2c] p-2.5 rounded-xl border border-amber-500/20 text-[11px] text-amber-300/90 space-y-1">
                  <p>
                    <span className="font-bold text-amber-300">+20 Board Bonus:</span> Extra points for matching an active board constraint (Category, Starting Letters, Contains pattern, or Length).
                  </p>
                  <p>
                    <span className="font-bold text-amber-300">+20 Daily Bonus Letter:</span> Extra points when your noun begins with the designated bonus letter of the day!
                  </p>
                </div>
              </div>

              {/* Rule 3: Game Modes */}
              <div className="bg-[#0d1322] p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-cyan-400 text-sm">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Game Modes</span>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="font-bold text-white block">1. Daily Word Quest (Solo)</span>
                  <p className="text-[11px] text-slate-400">
                    A shared deterministic 120-second challenge refreshed every midnight. Everyone gets the exact same board prompts. Your first run of the day logs your official ranked score to the Global Cloud Leaderboard. Unlimited practice runs thereafter!
                  </p>
                </div>

                <div className="space-y-1 text-xs border-t border-slate-800/80 pt-2">
                  <span className="font-bold text-white block">2. Party Rush (1–12 Players)</span>
                  <p className="text-[11px] text-slate-400">
                    Host or join via a 4-letter room code. All players race simultaneously on their own phones or computers with zero input lag. The shared leaderboard synchronizes live as players score!
                  </p>
                </div>
              </div>

              {/* Rule 4: Pro Tips */}
              <div className="bg-[#0d1322] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">Pro Tips:</span>
                <p>• Words cannot be submitted twice in the same round.</p>
                <p>• Aim for longer nouns matching multiple challenge prompts for huge score combos!</p>
                <p>• Tap any played word on the Game Over screen to inspect phonetic syllables, definitions, and usage examples.</p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5 shadow-lg shadow-amber-500/20"
            >
              Got it, let's play!
            </button>
          </div>
        </div>
      )}

      {/* AFFILIATE MONETIZATION MANAGER MODAL */}
      <AffiliateModal
        isOpen={showAffiliateModal}
        onClose={() => setShowAffiliateModal(false)}
      />

    </div>
  );
}
