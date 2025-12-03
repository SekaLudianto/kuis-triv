import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { ConnectionStatus, ChatMessage, GiftNotification, TikTokGiftEvent } from '../types';

// The backend server is expected to run on localhost:8081
const TIKTOK_LIVE_BACKEND_URL = 'https://ini-live.up.railway.app';

// Define the shape of the chat data coming from the backend
interface TikTokChatEvent {
  uniqueId: string;
  nickname: string;
  comment: string;
  profilePictureUrl: string;
  msgId: string;
}

const parseTikTokError = (reason: string): string => {
    if (typeof reason !== 'string') {
        return 'Terjadi error yang tidak diketahui saat menghubungkan ke TikTok.';
    }
    // Check for specific API code or text for user_not_found
    if (reason.includes('user_not_found') || reason.includes('19881007')) {
        return 'Username tidak ditemukan atau tidak sedang live. Mohon periksa kembali ejaan dan pastikan streamer sedang online.';
    }
    // Handle websocket upgrade failure
    if (reason.includes('websocket upgrade')) {
        return 'Koneksi ke TikTok gagal (metode websocket ditolak). Ini bisa terjadi jika TikTok mengubah API-nya. Coba lagi nanti.';
    }
    if (reason.includes('timeout')) {
        return 'Koneksi ke TikTok timeout. Pastikan koneksi internet Anda stabil dan coba lagi.';
    }
    if (reason.includes('Connection lost')) {
        return 'Koneksi ke TikTok terputus. Stream mungkin telah berakhir.';
    }
    return 'Gagal terhubung ke TikTok Live. Silakan coba lagi.';
};


export const useTikTokLive = (
    onMessage: (message: ChatMessage) => void,
    onGift: (gift: Omit<GiftNotification, 'id'>) => void
) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const socket = useRef<Socket | null>(null);

  // Use refs to store the latest callbacks, preventing stale closures
  const onMessageRef = useRef(onMessage);
  const onGiftRef = useRef(onGift);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onGiftRef.current = onGift;
  }, [onMessage, onGift]);

  // Add a cleanup effect to disconnect the socket when the component unmounts
  useEffect(() => {
    return () => {
      socket.current?.disconnect();
    };
  }, []);

  const connect = useCallback((username: string) => {
    if (socket.current?.connected) {
      socket.current.disconnect();
    }

    setConnectionStatus('connecting');
    setError(null);

    // Establish connection to the backend server
    socket.current = io(TIKTOK_LIVE_BACKEND_URL);

    // Event: Successfully connected to the backend WebSocket server
    socket.current.on('connect', () => {
      console.log('Connected to backend server, setting uniqueId...');
      socket.current?.emit('setUniqueId', username, {});
    });

    // Event: Backend confirms connection to TikTok Live
    socket.current.on('tiktokConnected', (state) => {
      console.log('Successfully connected to TikTok Live:', state);
      setConnectionStatus('connected');
    });

    // Event: Backend reports disconnection from TikTok Live
    socket.current.on('tiktokDisconnected', (reason: string) => {
      console.error('Disconnected from TikTok Live:', reason);
      setError(parseTikTokError(reason));
      setConnectionStatus('error');
      socket.current?.disconnect();
    });

    // Event: A new chat message is received
    socket.current.on('chat', (data: TikTokChatEvent) => {
      // Map the backend data to our internal ChatMessage type
      const message: ChatMessage = {
        id: data.msgId,
        userId: data.uniqueId,
        nickname: data.nickname,
        comment: data.comment,
        profilePictureUrl: data.profilePictureUrl,
        isWinner: false, // This will be determined by the game logic
      };
      // Call the latest onMessage callback via the ref
      onMessageRef.current(message);
    });

    // Event: A new gift is received
    socket.current.on('gift', (data: TikTokGiftEvent) => {
        const gift: Omit<GiftNotification, 'id'> = {
            userId: data.uniqueId,
            nickname: data.nickname,
            profilePictureUrl: data.profilePictureUrl,
            giftName: data.giftName,
            giftCount: data.giftCount,
            giftId: data.giftId,
        };
        // Call the latest onGift callback via the ref
        onGiftRef.current(gift);
    });

    // Event: Stream has ended
    socket.current.on('streamEnd', () => {
        console.log('The Live stream has ended.');
        setError('Siaran langsung telah berakhir.');
        setConnectionStatus('disconnected');
        socket.current?.disconnect();
    });

    // Event: Error connecting to the backend server
    socket.current.on('connect_error', (err) => {
      console.error('Failed to connect to backend server:', err);
      setError('Gagal terhubung ke server backend. Pastikan server berjalan.');
      setConnectionStatus('error');
    });
    
    // Event: Disconnected from backend server
    socket.current.on('disconnect', () => {
        setConnectionStatus((prevStatus) => {
            if (prevStatus !== 'error') {
                return 'disconnected';
            }
            return prevStatus;
        });
    });

  }, []); // Empty dependency array makes `connect` function stable

  const disconnect = useCallback(() => {
    socket.current?.disconnect();
    socket.current = null;
    setConnectionStatus('idle');
  }, []);

  return { connectionStatus, connect, disconnect, error };
};