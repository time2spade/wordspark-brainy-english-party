/**
 * Firebase Client SDK & Google Auth Integration for WordSpark.
 * Provides real Google Auth + Firestore cloud leaderboard with transparent demo fallback.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  Auth, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  Firestore 
} from 'firebase/firestore';

// ========================================================
// FIREBASE CONFIGURATION PLACEHOLDER
// Configure via Vite environment variables or replace below
// ========================================================
export const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyC8zmcgYq1s5Z_APW6CEMnl6zRowG1zgZQ",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "wordspark-brainy-english-party.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "wordspark-brainy-english-party",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "wordspark-brainy-english-party.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "430182134882",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:430182134882:web:caffe89016205eec518d3b",
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || "G-H8G91BV0PR"
};

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  isDemo?: boolean;
}

export interface DailyLeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  score: number;
  wordCount: number;
  bestWord: string;
  timestamp: number;
  rank?: number;
  isMe?: boolean;
}

class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  public isFirebaseReady: boolean = false;
  private mockUser: UserProfile | null = null;
  private authSubscribers: Array<(user: UserProfile | null) => void> = [];

  constructor() {
    this.initFirebase();
    this.loadSavedDemoUser();
  }

  private initFirebase() {
    try {
      const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("DemoPlaceholder");
      if (isPlaceholder) {
        this.isFirebaseReady = false;
        return;
      }

      this.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.isFirebaseReady = true;

      onAuthStateChanged(this.auth, (firebaseUser: User | null) => {
        if (firebaseUser) {
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Word Champion',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || null,
            isDemo: false
          };
          this.notifySubscribers(profile);
        } else if (!this.mockUser) {
          this.notifySubscribers(null);
        }
      });
    } catch (e) {
      console.warn("Firebase initialized in fallback demo mode:", e);
      this.isFirebaseReady = false;
    }
  }

  private loadSavedDemoUser() {
    try {
      const saved = localStorage.getItem('wordspark_demo_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.displayName === 'T2Spade') {
          localStorage.removeItem('wordspark_demo_user');
          this.mockUser = null;
        } else {
          this.mockUser = parsed;
        }
      }
    } catch (e) {}
  }

  public onAuthChange(callback: (user: UserProfile | null) => void): () => void {
    this.authSubscribers.push(callback);
    // Initial call
    callback(this.getCurrentUser());
    return () => {
      this.authSubscribers = this.authSubscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers(user: UserProfile | null) {
    this.authSubscribers.forEach(cb => cb(user));
  }

  public getCurrentUser(): UserProfile | null {
    if (this.auth?.currentUser) {
      return {
        uid: this.auth.currentUser.uid,
        displayName: this.auth.currentUser.displayName || 'Word Champion',
        email: this.auth.currentUser.email,
        photoURL: this.auth.currentUser.photoURL || null,
        isDemo: false
      };
    }
    return this.mockUser;
  }

  public getAuthInstance(): Auth | null {
    return this.auth;
  }

  public getDbInstance(): Firestore | null {
    return this.db;
  }

  /**
   * Signs in with Google via popup; falls back to demo mode gracefully
   */
  public async signInWithGoogle(): Promise<UserProfile> {
    if (this.isFirebaseReady && this.auth) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(this.auth, provider);
        const user = result.user;
        const profile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'Word Champion',
          email: user.email,
          photoURL: user.photoURL,
          isDemo: false
        };
        this.mockUser = null;
        localStorage.removeItem('wordspark_demo_user');
        this.notifySubscribers(profile);
        return profile;
      } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user') {
          throw new Error('Sign-in popup was closed.');
        }
        console.warn("Google popup issue:", err);
        const enhancedError = new Error(err.message || 'Google sign-in encountered an issue.');
        (enhancedError as any).code = err.code || 'auth/unknown';
        (enhancedError as any).original = err;
        throw enhancedError;
      }
    }

    // Fallback: Instant Demo Google Account
    return this.signInAsDemoUser();
  }

  /**
   * Demo sign-in for preview environments & unconfigured projects
   */
  public signInAsDemoUser(customName?: string, customEmail?: string): UserProfile {
    const demoNames = ['WordWizard', 'LexiNinja', 'BrainyPanda', 'SpellingBee', 'WordNinja'];
    const chosenName = (customName && customName.trim()) || 'Player';
    const email = customEmail || `${chosenName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
    const profile: UserProfile = {
      uid: `player_${chosenName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.floor(Math.random() * 900 + 100)}`,
      displayName: chosenName,
      email: email,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${chosenName}`,
      isDemo: true
    };
    this.mockUser = profile;
    localStorage.setItem('wordspark_demo_user', JSON.stringify(profile));
    this.notifySubscribers(profile);
    return profile;
  }

  public async signOutUser(): Promise<void> {
    if (this.auth) {
      try {
        await signOut(this.auth);
      } catch (e) {}
    }
    this.mockUser = null;
    localStorage.removeItem('wordspark_demo_user');
    this.notifySubscribers(null);
  }

  /**
   * Checks whether the user has already recorded an official scored run for dateStr
   */
  public hasCompletedOfficialRun(uid: string, dateStr: string): boolean {
    const key = `wordspark_completed_${dateStr}_${uid}`;
    return localStorage.getItem(key) === 'true';
  }

  /**
   * Marks official run completed
   */
  public markOfficialRunCompleted(uid: string, dateStr: string, score: number) {
    const key = `wordspark_completed_${dateStr}_${uid}`;
    localStorage.setItem(key, 'true');
    localStorage.setItem(`wordspark_score_${dateStr}_${uid}`, String(score));
  }

  /**
   * Submits daily score to Firestore with fallback to localStorage
   */
  public async submitDailyScore(
    dateStr: string,
    entry: Omit<DailyLeaderboardEntry, 'rank' | 'isMe'>
  ): Promise<void> {
    // 1. Always save locally first for instantaneous feedback & offline durability
    this.saveScoreToLocalStorage(dateStr, entry);
    this.markOfficialRunCompleted(entry.uid, dateStr, entry.score);

    // 2. Write to Firestore if connected
    if (this.isFirebaseReady && this.db) {
      try {
        const scoreDocRef = doc(this.db, 'daily_leaderboards', dateStr, 'scores', entry.uid);
        await setDoc(scoreDocRef, {
          uid: entry.uid,
          displayName: entry.displayName,
          photoURL: entry.photoURL,
          score: entry.score,
          wordCount: entry.wordCount,
          bestWord: entry.bestWord,
          timestamp: entry.timestamp
        });
      } catch (e) {
        console.warn("Could not save to Firestore, local state preserved:", e);
      }
    }
  }

  /**
   * Fetches daily leaderboard for a given date
   */
  public async fetchDailyLeaderboard(dateStr: string, currentUid?: string): Promise<DailyLeaderboardEntry[]> {
    let cloudScores: DailyLeaderboardEntry[] = [];

    // Attempt Firestore fetch
    if (this.isFirebaseReady && this.db) {
      try {
        const scoresRef = collection(this.db, 'daily_leaderboards', dateStr, 'scores');
        const q = query(scoresRef, orderBy('score', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          cloudScores.push({
            uid: data.uid,
            displayName: data.displayName || 'Challenger',
            photoURL: data.photoURL || null,
            score: data.score || 0,
            wordCount: data.wordCount || 0,
            bestWord: data.bestWord || '—',
            timestamp: data.timestamp || Date.now()
          });
        });
      } catch (e) {
        console.warn("Firestore fetch notice; using local/community leaderboard:", e);
      }
    }

    // Merge with local storage entries for that date
    const localScores = this.getScoresFromLocalStorage(dateStr);
    
    // Combine and deduplicate by uid
    const scoreMap = new Map<string, DailyLeaderboardEntry>();
    [...cloudScores, ...localScores].forEach(entry => {
      const existing = scoreMap.get(entry.uid);
      if (!existing || entry.score > existing.score) {
        scoreMap.set(entry.uid, entry);
      }
    });

    const ranked = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score || b.wordCount - a.wordCount)
      .slice(0, 50)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        isMe: Boolean(currentUid && entry.uid === currentUid)
      }));

    return ranked;
  }

  private saveScoreToLocalStorage(dateStr: string, entry: Omit<DailyLeaderboardEntry, 'rank' | 'isMe'>) {
    try {
      const key = `wordspark_daily_scores_${dateStr}`;
      const existing = this.getScoresFromLocalStorage(dateStr);
      const filtered = existing.filter(e => e.uid !== entry.uid);
      filtered.push(entry);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {}
  }

  private getScoresFromLocalStorage(dateStr: string): DailyLeaderboardEntry[] {
    try {
      const key = `wordspark_daily_scores_${dateStr}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export const firebaseService = new FirebaseService();
