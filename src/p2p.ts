/**
 * P2P WebRTC networking module via PeerJS.
 * Supports simultaneous Word Rush: Host coordinates room and aggregates real-time leaderboard.
 */

import { ChallengePrompt } from './dictionary';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  score: number;
  wordCount: number;
  bestWord: string;
  bestWordPoints: number;
  connected?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  score: number;
  wordCount: number;
  bestWord: string;
  bestWordPoints: number;
  rank?: number;
}

export interface NetworkMessage {
  type: 
    | 'JOIN_REQUEST' 
    | 'PLAYER_LIST_UPDATE' 
    | 'START_GAME' 
    | 'UPDATE_SCORE' 
    | 'LEADERBOARD_SYNC' 
    | 'END_GAME' 
    | 'PARTY_EMOJI' 
    | 'ERROR';
  payload: any;
  senderId?: string;
}

export function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous I, O
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

export const AVATAR_OPTIONS = [
  '⚡', '🦊', '🦁', '🐼', '🐸', '🐙', 
  '🦄', '🚀', '🥑', '🍕', '🎯', '👑'
];

declare global {
  interface Window {
    Peer?: any;
  }
}

export class P2PManager {
  private peer: any = null;
  private connections: Map<string, any> = new Map();
  private hostConn: any = null;
  public myPeerId: string = '';
  public roomCode: string = '';
  public isHost: boolean = false;
  
  private onMessageCallback: (msg: NetworkMessage) => void = () => {};
  private onStatusChangeCallback: (status: string, isError?: boolean) => void = () => {};

  constructor(
    onMessage: (msg: NetworkMessage) => void,
    onStatusChange: (status: string, isError?: boolean) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;
  }

  /**
   * Initializes host room with 4-letter code
   */
  public async createRoom(desiredCode?: string): Promise<string> {
    this.destroy();
    this.isHost = true;
    const code = desiredCode ? desiredCode.toUpperCase() : generateRoomCode();
    this.roomCode = code;
    const peerId = `wordrush-room-${code.toLowerCase()}`;

    return new Promise((resolve, reject) => {
      try {
        const PeerClass = window.Peer;
        if (!PeerClass) {
          throw new Error('PeerJS library not loaded.');
        }

        this.peer = new PeerClass(peerId, {
          debug: 1
        });

        this.peer.on('open', (id: string) => {
          this.myPeerId = id;
          this.onStatusChangeCallback(`Room ${code} open! Waiting for players...`);
          resolve(code);
        });

        this.peer.on('connection', (conn: any) => {
          this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          if (err.type === 'unavailable-id') {
            const freshCode = generateRoomCode();
            this.createRoom(freshCode).then(resolve).catch(reject);
          } else {
            this.onStatusChangeCallback(`Network notice: ${err.message || 'Connection issue'}`, true);
            reject(err);
          }
        });
      } catch (err: any) {
        this.onStatusChangeCallback(err.message || 'P2P setup failed', true);
        reject(err);
      }
    });
  }

  /**
   * Joins an existing host room by 4-letter code
   */
  public async joinRoom(code: string, playerName: string, avatar: string): Promise<void> {
    this.destroy();
    this.isHost = false;
    this.roomCode = code.toUpperCase();
    const targetPeerId = `wordrush-room-${this.roomCode.toLowerCase()}`;

    return new Promise((resolve, reject) => {
      try {
        const PeerClass = window.Peer;
        if (!PeerClass) {
          throw new Error('PeerJS library not loaded.');
        }

        this.peer = new PeerClass({
          debug: 1
        });

        this.peer.on('open', (id: string) => {
          this.myPeerId = id;
          this.onStatusChangeCallback(`Connecting to room ${this.roomCode}...`);

          const conn = this.peer.connect(targetPeerId, { reliable: true });
          this.hostConn = conn;

          conn.on('open', () => {
            this.onStatusChangeCallback(`Connected to room ${this.roomCode}!`);
            // Send join request
            conn.send({
              type: 'JOIN_REQUEST',
              payload: {
                name: playerName,
                avatar: avatar,
                id: this.myPeerId
              }
            });
            resolve();
          });

          conn.on('data', (data: NetworkMessage) => {
            this.onMessageCallback(data);
          });

          conn.on('close', () => {
            this.onStatusChangeCallback('Host left or room closed.', true);
          });

          conn.on('error', (err: any) => {
            this.onStatusChangeCallback(`Connection error: ${err.message}`, true);
            reject(err);
          });
        });

        this.peer.on('error', (err: any) => {
          this.onStatusChangeCallback(`Could not connect: Room code may be invalid.`, true);
          reject(err);
        });
      } catch (err: any) {
        this.onStatusChangeCallback(err.message || 'Join failed', true);
        reject(err);
      }
    });
  }

  private handleIncomingConnection(conn: any) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data: NetworkMessage) => {
      data.senderId = conn.peer;
      this.onMessageCallback(data);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.onMessageCallback({
        type: 'PLAYER_LIST_UPDATE',
        payload: { disconnectedId: conn.peer }
      });
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
    });
  }

  /**
   * Host broadcasts message to all connected peers
   */
  public broadcast(message: NetworkMessage) {
    if (!this.isHost) {
      if (this.hostConn && this.hostConn.open) {
        this.hostConn.send(message);
      }
      return;
    }
    for (const [_, conn] of this.connections) {
      if (conn.open) {
        conn.send(message);
      }
    }
  }

  /**
   * Guest sends message directly to host
   */
  public sendToHost(message: NetworkMessage) {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(message);
    }
  }

  public destroy() {
    if (this.connections) {
      for (const [_, conn] of this.connections) {
        try { conn.close(); } catch (e) {}
      }
      this.connections.clear();
    }
    if (this.hostConn) {
      try { this.hostConn.close(); } catch (e) {}
      this.hostConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
  }
}
