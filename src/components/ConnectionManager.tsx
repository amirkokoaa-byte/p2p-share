import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import {
  Wifi,
  QrCode,
  Camera,
  Copy,
  Check,
  Upload,
  Pause,
  Play,
  X,
  RefreshCw,
  Link2,
  ShieldCheck,
  FileVideo,
  FileText,
  Zap,
  AlertCircle,
  CheckCircle2,
  ArrowUpLeft,
  ArrowDownRight,
} from 'lucide-react';
import {
  ConnectionStatus,
  FileTransferItem,
  ReceivedFileItem,
  SignalingDataPacket,
} from '../types';
import { FluentCard } from './FluentCard';

// حجم الجزء الواحد (Chunk Size) = 64 كيلوبايت لضمان أعلى سرعة عبر RTCDataChannel مع دعم الإيقاف المؤقت
const CHUNK_SIZE = 64 * 1024;
// بادئة معرف PeerJS لربط رمز الـ PIN المكون من 6 أرقام
const PEER_PREFIX = 'localshare-p2p-v1-';

interface ConnectionManagerProps {
  onFileReceived: (file: ReceivedFileItem) => void;
  receivedCount: number;
  onNavigateToFiles: () => void;
}

/**
 * دالة مساعدة لتنسيق الحجم المطلق للملف (بايت، كيلوبايت، ميجابايت، جيجابايت)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 1)} ${sizes[i]}`;
}

/**
 * مكون إدارة الاتصال والنقل المباشر (ConnectionManager)
 * يتولى إقران الأجهزة عبر WebRTC (QR / 6-Digit PIN) وتقسيم الملفات الكبيرة مع دعم الإيقاف المؤقت والاستئناف
 */
export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  onFileReceived,
  receivedCount,
  onNavigateToFiles,
}) => {
  // توليد رمز PIN عشوائي مكون من 6 أرقام لهذا الجهاز
  const [myPin, setMyPin] = useState<string>(() =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );
  const [targetPin, setTargetPin] = useState<string>('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectedPeerPin, setConnectedPeerPin] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    'جاري تهيئة محرك الاتصال المحلي WebRTC...'
  );
  const [copiedPin, setCopiedPin] = useState<boolean>(false);

  // حالة ماسح رمز QR بالكاميرا
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanRafRef = useRef<number | null>(null);

  // حالة قائمة عمليات النقل الجارية والمكتملة
  const [transfers, setTransfers] = useState<FileTransferItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // مراجع WebRTC وقناة الاتصال المحلية
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const isLoopbackModeRef = useRef<boolean>(false);

  // مراجع للتحكم في الإيقاف المؤقت والاستئناف وتجميع الأجزاء المستلمة
  const pausedTransfersRef = useRef<Set<string>>(new Set());
  const cancelledTransfersRef = useRef<Set<string>>(new Set());
  const incomingBuffersRef = useRef<
    Map<
      string,
      {
        fileName: string;
        fileSize: number;
        fileType: string;
        totalChunks: number;
        chunks: Uint8Array[];
        receivedBytes: number;
        lastTickTime: number;
        lastTickBytes: number;
      }
    >
  >(new Map());

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // إرسال حزمة بيانات عبر WebRTC أو عبر قناة المحاكاة المحلية عند الاختبار
  const sendPacket = useCallback((packet: SignalingDataPacket) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(packet);
    } else if (isLoopbackModeRef.current && broadcastRef.current) {
      broadcastRef.current.postMessage(packet);
    }
  }, []);

  // معالجة الحزم الواردة عبر WebRTC DataChannel
  const handleIncomingData = useCallback(
    (rawData: unknown) => {
      const packet = rawData as SignalingDataPacket;
      if (!packet || typeof packet !== 'object' || !('type' in packet)) return;

      if (packet.type === 'FILE_META') {
        // بدء استقبال ملف جديد
        incomingBuffersRef.current.set(packet.transferId, {
          fileName: packet.fileName,
          fileSize: packet.fileSize,
          fileType: packet.fileType || 'application/octet-stream',
          totalChunks: packet.totalChunks,
          chunks: [],
          receivedBytes: 0,
          lastTickTime: performance.now(),
          lastTickBytes: 0,
        });

        setTransfers((prev) => [
          {
            id: packet.transferId,
            fileName: packet.fileName,
            fileSize: packet.fileSize,
            fileType: packet.fileType || 'application/octet-stream',
            direction: 'receive',
            transferredBytes: 0,
            speedBytesPerSec: 0,
            status: 'transferring',
            totalChunks: packet.totalChunks,
            currentChunk: 0,
            startedAt: Date.now(),
          },
          ...prev,
        ]);
      } else if (packet.type === 'FILE_CHUNK') {
        const bufferEntry = incomingBuffersRef.current.get(packet.transferId);
        if (!bufferEntry) return;

        // تحويل البيانات الواردة إلى Uint8Array
        let chunkArray: Uint8Array;
        if (packet.data instanceof ArrayBuffer) {
          chunkArray = new Uint8Array(packet.data);
        } else if (ArrayBuffer.isView(packet.data)) {
          chunkArray = new Uint8Array(
            packet.data.buffer,
            packet.data.byteOffset,
            packet.data.byteLength
          );
        } else if (typeof packet.data === 'string') {
          const binaryString = atob(packet.data);
          chunkArray = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            chunkArray[i] = binaryString.charCodeAt(i);
          }
        } else {
          return;
        }

        bufferEntry.chunks.push(chunkArray);
        bufferEntry.receivedBytes += chunkArray.byteLength;

        const now = performance.now();
        const elapsedSec = (now - bufferEntry.lastTickTime) / 1000;
        let currentSpeed = 0;

        if (elapsedSec >= 0.25) {
          const bytesDelta = bufferEntry.receivedBytes - bufferEntry.lastTickBytes;
          currentSpeed = bytesDelta / elapsedSec;
          bufferEntry.lastTickTime = now;
          bufferEntry.lastTickBytes = bufferEntry.receivedBytes;
        }

        const newReceivedBytes = bufferEntry.receivedBytes;
        const currentChunkCount = bufferEntry.chunks.length;

        setTransfers((prev) =>
          prev.map((item) =>
            item.id === packet.transferId && item.direction === 'receive'
              ? {
                  ...item,
                  transferredBytes: Math.min(newReceivedBytes, item.fileSize),
                  currentChunk: currentChunkCount,
                  speedBytesPerSec:
                    currentSpeed > 0 ? currentSpeed : item.speedBytesPerSec,
                }
              : item
          )
        );
      } else if (packet.type === 'TRANSFER_CONTROL') {
        // معالجة أوامر الإيقاف المؤقت أو الاستئناف أو الإلغاء من الطرف الآخر
        if (packet.action === 'PAUSE') {
          pausedTransfersRef.current.add(packet.transferId);
          setTransfers((prev) =>
            prev.map((item) =>
              item.id === packet.transferId
                ? { ...item, status: 'paused', speedBytesPerSec: 0 }
                : item
            )
          );
        } else if (packet.action === 'RESUME') {
          pausedTransfersRef.current.delete(packet.transferId);
          setTransfers((prev) =>
            prev.map((item) =>
              item.id === packet.transferId
                ? { ...item, status: 'transferring' }
                : item
            )
          );
        } else if (packet.action === 'CANCEL') {
          cancelledTransfersRef.current.add(packet.transferId);
          incomingBuffersRef.current.delete(packet.transferId);
          setTransfers((prev) =>
            prev.map((item) =>
              item.id === packet.transferId
                ? { ...item, status: 'cancelled', speedBytesPerSec: 0 }
                : item
            )
          );
        }
      } else if (packet.type === 'FILE_COMPLETE') {
        const bufferEntry = incomingBuffersRef.current.get(packet.transferId);
        if (!bufferEntry) return;

        // تجميع الأجزاء في ملف Blob محلي كامل وإنشاء رابط معاينة وتنزيل فوري
        const blob = new Blob(bufferEntry.chunks, { type: bufferEntry.fileType });
        const blobUrl = URL.createObjectURL(blob);

        setTransfers((prev) =>
          prev.map((item) =>
            item.id === packet.transferId && item.direction === 'receive'
              ? {
                  ...item,
                  transferredBytes: bufferEntry.fileSize,
                  speedBytesPerSec: 0,
                  status: 'completed',
                  blobUrl,
                }
              : item
          )
        );

        // إضافة الملف المكتمل إلى لوحة إدارة الملفات
        onFileReceived({
          id: `${packet.transferId}-${Date.now()}`,
          name: bufferEntry.fileName,
          size: bufferEntry.fileSize,
          type: bufferEntry.fileType,
          blobUrl,
          receivedAt: new Date().toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
          selected: false,
        });

        incomingBuffersRef.current.delete(packet.transferId);
      }
    },
    [onFileReceived]
  );

  // إعداد اتصال PeerJS عند تغير رمز الـ PIN المحلي
  useEffect(() => {
    setStatus('disconnected');
    setStatusMessage('جاري تسجيل رمز الـ PIN المحلي على خادم الإشارة...');

    const peer = new Peer(`${PEER_PREFIX}${myPin}`, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    peerRef.current = peer;

    peer.on('open', () => {
      setStatus('ready');
      setStatusMessage('جاهز للاتصال المحلي — شارك رمز الـ PIN أو امسح رمز الـ QR');

      // التحقق مما إذا كان الرابط يحتوي على رمز PIN للإقران التلقائي عبر مسح الكاميرا
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin');
      if (urlPin && /^\d{6}$/.test(urlPin) && urlPin !== myPin) {
        setTargetPin(urlPin);
      }
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      isLoopbackModeRef.current = false;
      const remotePin = conn.peer.replace(PEER_PREFIX, '');

      conn.on('open', () => {
        setStatus('connected');
        setConnectedPeerPin(remotePin);
        setStatusMessage(`متصل مباشرة عبر WebRTC بالجهاز رقم (${remotePin})`);
      });

      conn.on('data', (data) => {
        handleIncomingData(data);
      });

      conn.on('close', () => {
        setStatus('ready');
        setConnectedPeerPin(null);
        setStatusMessage('انتهت جلسة الاتصال مع الجهاز المقابل — جاهز لاتصال جديد');
      });

      conn.on('error', () => {
        setStatus('error');
        setStatusMessage('حدث خطأ أثناء نقل البيانات عبر القناة المحلية');
      });
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // في حال مصادفة رقم PIN مستخدم، نولد رقماً جديداً تلقائياً
        setMyPin(Math.floor(100000 + Math.random() * 900000).toString());
      } else if (err.type === 'peer-unavailable') {
        setStatus('ready');
        setStatusMessage('لم يتم العثور على جهاز متصل بهذا الرمز — تأكد من الرقم وحاول مجدداً');
      } else {
        setStatus('ready');
        setStatusMessage('وضع الشبكة المحلية جاهز (يدعم WebRTC و BroadcastChannel)');
      }
    });

    // إعداد قناة BroadcastChannel لدعم الاتصال المباشر بين نوافذ المتصفح على نفس الجهاز بدون إنترنت
    const bc = new BroadcastChannel('localshare_p2p_lan_channel');
    broadcastRef.current = bc;
    bc.onmessage = (event) => {
      const msg = event.data;
      if (msg?.type === 'LOCAL_PAIR_REQUEST' && msg.targetPin === myPin) {
        isLoopbackModeRef.current = true;
        setStatus('connected');
        setConnectedPeerPin(msg.senderPin);
        setStatusMessage(`متصل محلياً بالجهاز (${msg.senderPin}) عبر القناة المباشرة`);
        bc.postMessage({
          type: 'LOCAL_PAIR_ACCEPTED',
          targetPin: msg.senderPin,
          senderPin: myPin,
        });
      } else if (msg?.type === 'LOCAL_PAIR_ACCEPTED' && msg.targetPin === myPin) {
        isLoopbackModeRef.current = true;
        setStatus('connected');
        setConnectedPeerPin(msg.senderPin);
        setStatusMessage(`متصل محلياً بالجهاز (${msg.senderPin}) عبر القناة المباشرة`);
      } else if (isLoopbackModeRef.current && msg?.type) {
        handleIncomingData(msg);
      }
    };

    return () => {
      bc.close();
      peer.destroy();
    };
  }, [myPin, handleIncomingData]);

  // الاتصال بجهاز آخر عبر رمز PIN المكون من 6 أرقام
  const connectToPeer = useCallback(
    (pinToConnect?: string) => {
      const cleanPin = (pinToConnect ?? targetPin).trim();
      if (!/^\d{6}$/.test(cleanPin)) {
        setStatusMessage('يرجى إدخال رمز PIN صحيح مكون من 6 أرقام');
        return;
      }

      if (cleanPin === myPin) {
        // تفعيل وضع الاختبار المحلي الفوري على نفس الجهاز
        isLoopbackModeRef.current = true;
        setStatus('connected');
        setConnectedPeerPin(`${myPin} (محلي)`);
        setStatusMessage('تم تفعيل وضع النقل المحلي الفوري (Loopback P2P) لاختبار السرعة والتقسيم');
        return;
      }

      setStatus('connecting');
      setStatusMessage(`جاري البحث والاقتران بالجهاز (${cleanPin})...`);

      // إرسال طلب إقران عبر BroadcastChannel للنوافذ المحلية أولاً
      broadcastRef.current?.postMessage({
        type: 'LOCAL_PAIR_REQUEST',
        targetPin: cleanPin,
        senderPin: myPin,
      });

      // فتح اتصال WebRTC DataChannel عبر PeerJS
      if (peerRef.current && !peerRef.current.disconnected) {
        const conn = peerRef.current.connect(`${PEER_PREFIX}${cleanPin}`, {
          reliable: true,
        });
        connRef.current = conn;

        conn.on('open', () => {
          isLoopbackModeRef.current = false;
          setStatus('connected');
          setConnectedPeerPin(cleanPin);
          setStatusMessage(`متصل بنجاح عبر WebRTC بالجهاز (${cleanPin})`);
        });

        conn.on('data', (data) => {
          handleIncomingData(data);
        });

        conn.on('close', () => {
          setStatus('ready');
          setConnectedPeerPin(null);
          setStatusMessage('تم إغلاق الاتصال من قِبل الطرف الآخر');
        });
      }
    },
    [targetPin, myPin, handleIncomingData]
  );

  // إيقاف الكاميرا عند إغلاق نافذة الماسح الضوئي
  const stopScanner = useCallback(() => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setScannerOpen(false);
  }, []);

  // تشغيل كاميرا الجهاز لمسح رمز QR
  const startScanner = async () => {
    setCameraError(null);
    setScannerOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        const tick = () => {
          if (
            videoRef.current &&
            canvasRef.current &&
            videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
          ) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.height = videoRef.current.videoHeight;
              canvas.width = videoRef.current.videoWidth;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });

              if (code && code.data) {
                // استخراج رمز الـ PIN المكون من 6 أرقام من النص أو الرابط الممسوح
                const match = code.data.match(/\b(\d{6})\b/);
                if (match) {
                  const detectedPin = match[1];
                  setTargetPin(detectedPin);
                  stopScanner();
                  connectToPeer(detectedPin);
                  return;
                }
              }
            }
          }
          scanRafRef.current = requestAnimationFrame(tick);
        };

        scanRafRef.current = requestAnimationFrame(tick);
      }
    } catch {
      setCameraError(
        'تعذر الوصول إلى الكاميرا المباشرة. يمكنك رفع صورة رمز QR أو إدخال رمز الـ PIN المكون من 6 أرقام يدوياً.'
      );
    }
  };

  // مسح رمز QR من ملف صورة محفوظ على الجهاز (بديل عملي لأجهزة سطح المكتب بدون كاميرا)
  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const match = code.data.match(/\b(\d{6})\b/);
          if (match) {
            const detectedPin = match[1];
            setTargetPin(detectedPin);
            stopScanner();
            connectToPeer(detectedPin);
          } else {
            setCameraError('لم يتم العثور على رمز PIN صالح مكون من 6 أرقام داخل رمز الـ QR');
          }
        } else {
          setCameraError('لم يتم التعرف على رمز QR واضح في الصورة المختارة');
        }
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // خوارزمية تقسيم وإرسال الملف عبر WebRTC مع دعم الإيقاف المؤقت (Pause) والاستئناف (Resume)
  const sendFileInChunks = async (file: File) => {
    // إذا لم يكن متصلاً بجهاز آخر، نفعل وضع النقل المحلي الفوري حتى يتمكن المستخدم من تجربة النقل والتقسيم مباشرة
    const isDirectLoopback = status !== 'connected' || isLoopbackModeRef.current;
    if (status !== 'connected') {
      isLoopbackModeRef.current = true;
      setStatus('connected');
      setConnectedPeerPin(`${myPin} (نقل محلي فوري)`);
      setStatusMessage('تم تفعيل النقل المحلي الفوري لمعاينة تقسيم الملفات والسرعة الحية');
    }

    const transferId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;

    // إضافة عملية الإرسال إلى الواجهة
    setTransfers((prev) => [
      {
        id: transferId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        direction: 'send',
        transferredBytes: 0,
        speedBytesPerSec: 0,
        status: 'transferring',
        totalChunks,
        currentChunk: 0,
        startedAt: Date.now(),
      },
      ...prev,
    ]);

    const metaPacket: SignalingDataPacket = {
      type: 'FILE_META',
      transferId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      totalChunks,
    };

    sendPacket(metaPacket);
    if (isDirectLoopback) {
      handleIncomingData(metaPacket);
    }

    let offset = 0;
    let chunkIndex = 0;
    let lastSpeedTime = performance.now();
    let bytesSinceLastSpeed = 0;

    while (offset < file.size) {
      // التحقق مما إذا تم إلغاء النقل
      if (cancelledTransfersRef.current.has(transferId)) {
        return;
      }

      // الانتظار أثناء الإيقاف المؤقت (Suspend / Pause) دون فقدان حالة الجزء الحالي
      while (pausedTransfersRef.current.has(transferId)) {
        if (cancelledTransfersRef.current.has(transferId)) return;
        await new Promise((r) => setTimeout(r, 120));
      }

      // التحكم في ضغط البيانات (Backpressure) لقناة WebRTC لمنع امتلاء الذاكرة في الفيديوهات الكبيرة
      const rawDataChannel = (
        connRef.current as unknown as { dataChannel?: RTCDataChannel }
      )?.dataChannel;
      if (rawDataChannel && rawDataChannel.bufferedAmount > 4 * 1024 * 1024) {
        await new Promise((r) => setTimeout(r, 25));
        continue;
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await slice.arrayBuffer();

      const chunkPacket: SignalingDataPacket = {
        type: 'FILE_CHUNK',
        transferId,
        chunkIndex,
        data: arrayBuffer,
      };

      sendPacket(chunkPacket);
      if (isDirectLoopback) {
        handleIncomingData(chunkPacket);
      }

      offset += arrayBuffer.byteLength;
      chunkIndex += 1;
      bytesSinceLastSpeed += arrayBuffer.byteLength;

      const now = performance.now();
      const elapsedSec = (now - lastSpeedTime) / 1000;

      if (elapsedSec >= 0.2 || offset >= file.size) {
        const currentSpeed = elapsedSec > 0 ? bytesSinceLastSpeed / elapsedSec : 0;
        lastSpeedTime = now;
        bytesSinceLastSpeed = 0;

        const currentOffset = offset;
        const currentIdx = chunkIndex;

        setTransfers((prev) =>
          prev.map((item) =>
            item.id === transferId && item.direction === 'send'
              ? {
                  ...item,
                  transferredBytes: currentOffset,
                  currentChunk: currentIdx,
                  speedBytesPerSec: currentSpeed,
                }
              : item
          )
        );

        // إتاحة دورة تحديث للواجهة الرسومية وشريط التقدم
        await new Promise((r) => setTimeout(r, 12));
      }
    }

    // إرسال إشارة اكتمال جميع أجزاء الملف
    const completePacket: SignalingDataPacket = {
      type: 'FILE_COMPLETE',
      transferId,
    };
    sendPacket(completePacket);
    if (isDirectLoopback) {
      handleIncomingData(completePacket);
    }

    setTransfers((prev) =>
      prev.map((item) =>
        item.id === transferId && item.direction === 'send'
          ? {
              ...item,
              transferredBytes: file.size,
              speedBytesPerSec: 0,
              status: 'completed',
            }
          : item
      )
    );
  };

  // التعامل مع اختيار ملف أو عدة ملفات
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    for (const file of filesArray) {
      await sendFileInChunks(file);
    }
  };

  // إيقاف مؤقت أو استئناف عملية النقل (Pause / Resume)
  const togglePauseTransfer = (transferId: string) => {
    const isCurrentlyPaused = pausedTransfersRef.current.has(transferId);
    const nextAction = isCurrentlyPaused ? 'RESUME' : 'PAUSE';

    if (isCurrentlyPaused) {
      pausedTransfersRef.current.delete(transferId);
    } else {
      pausedTransfersRef.current.add(transferId);
    }

    setTransfers((prev) =>
      prev.map((item) =>
        item.id === transferId
          ? {
              ...item,
              status: isCurrentlyPaused ? 'transferring' : 'paused',
              speedBytesPerSec: isCurrentlyPaused ? item.speedBytesPerSec : 0,
            }
          : item
      )
    );

    sendPacket({
      type: 'TRANSFER_CONTROL',
      transferId,
      action: nextAction,
    });
  };

  // إلغاء عملية نقل جارية
  const cancelTransfer = (transferId: string) => {
    cancelledTransfersRef.current.add(transferId);
    pausedTransfersRef.current.delete(transferId);
    incomingBuffersRef.current.delete(transferId);

    setTransfers((prev) =>
      prev.map((item) =>
        item.id === transferId
          ? { ...item, status: 'cancelled', speedBytesPerSec: 0 }
          : item
      )
    );

    sendPacket({
      type: 'TRANSFER_CONTROL',
      transferId,
      action: 'CANCEL',
    });
  };

  // نسخ رمز الـ PIN إلى الحافظة
  const copyMyPin = async () => {
    try {
      await navigator.clipboard.writeText(myPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // تجاهل في حال عدم توفر صلاحية الحافظة
    }
  };

  // رابط الإقران المضمن داخل رمز الـ QR
  const pairingUrl = `${window.location.origin}${window.location.pathname}?pin=${myPin}`;

  return (
    <div className="space-y-6">
      {/* شريط حالة الاتصال العلوي */}
      <FluentCard className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-sm flex items-center justify-center border shrink-0 ${
                status === 'connected'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : status === 'connecting'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-sky-500/15 border-sky-500/40 text-sky-400'
              }`}
            >
              {status === 'connected' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <Wifi className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>حالة الجسر المحلي (WebRTC P2P)</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    status === 'connected'
                      ? 'text-emerald-400 font-semibold'
                      : status === 'connecting'
                      ? 'text-amber-400 font-semibold'
                      : 'text-sky-400 font-semibold'
                  }
                >
                  {status === 'connected'
                    ? `متصل بالجهاز (${connectedPeerPin})`
                    : status === 'connecting'
                    ? 'جاري الاقتران...'
                    : 'جاهز للإقران'}
                </span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-100 mt-0.5">
                {statusMessage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            {receivedCount > 0 && (
              <button
                onClick={onNavigateToFiles}
                className="fluent-edge-btn px-3.5 py-2 rounded-sm bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                عرض الملفات المستلمة ({receivedCount})
              </button>
            )}
            <button
              onClick={() =>
                setMyPin(Math.floor(100000 + Math.random() * 900000).toString())
              }
              className="fluent-edge-btn flex items-center gap-1.5 px-3 py-2 rounded-sm bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/60 text-xs font-medium cursor-pointer whitespace-nowrap"
              title="توليد رمز PIN جديد"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تجديد الرمز</span>
            </button>
          </div>
        </div>
      </FluentCard>

      {/* شبكة الإقران: بطاقة هويتي (QR + PIN) + بطاقة الاتصال بجهاز آخر */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* القسم الأيمن: رمز الـ PIN الخاص بهذا الجهاز ورمز الـ QR */}
        <FluentCard className="lg:col-span-5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">01. هوية هذا الجهاز</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  امسح رمز الـ QR من الهاتف أو أدخل الأرقام الستة في الجهاز الآخر
                </p>
              </div>
              <QrCode className="w-5 h-5 text-sky-400 shrink-0" />
            </div>

            {/* عرض رمز QR الديناميكي */}
            <div className="flex flex-col items-center justify-center my-4">
              <div className="p-4 bg-white rounded-sm shadow-lg border-2 border-sky-400/60">
                <QRCodeSVG
                  value={pairingUrl}
                  size={168}
                  bgColor="#FFFFFF"
                  fgColor="#0A1128"
                  level="M"
                  includeMargin={false}
                />
              </div>
              <span className="text-xs text-slate-400 mt-2.5">
                يتضمن رمز الإقران المباشر: <strong className="font-mono text-slate-200">{myPin}</strong>
              </span>
            </div>
          </div>

          {/* عرض رمز الـ PIN المكون من 6 أرقام */}
          <div className="mt-4 pt-4 border-t border-slate-700/60">
            <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
              <span>رمز الـ PIN المكون من 6 أرقام:</span>
              <span className="text-sky-400">تشفير WebRTC DTLS</span>
            </div>
            <div className="flex items-center justify-between gap-3 bg-slate-950/80 border border-slate-700/80 px-4 py-3 rounded-sm">
              <span
                dir="ltr"
                className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.28em] text-sky-400 tabular-nums select-all"
              >
                {myPin}
              </span>
              <button
                onClick={copyMyPin}
                className="fluent-edge-btn flex items-center gap-1.5 px-3 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/60 text-xs font-medium cursor-pointer shrink-0"
              >
                {copiedPin ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-sky-400" />
                    <span>نسخ الرمز</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </FluentCard>

        {/* القسم الأيسر: الاتصال بجهاز آخر + إرسال الملفات والفيديوهات */}
        <FluentCard className="lg:col-span-7 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  02. الربط وإرسال الملفات والفيديوهات
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  أدخل رمز الجهاز المقابل (6 أرقام) أو امسح رمز الـ QR بالكاميرا
                </p>
              </div>
              <Link2 className="w-5 h-5 text-sky-400 shrink-0" />
            </div>

            {/* حقل إدخال رمز PIN + أزرار الاتصال ومسح الكاميرا */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-300 mb-1.5">
                  رمز PIN للجهاز الآخر (6 أرقام):
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  dir="ltr"
                  value={targetPin}
                  onChange={(e) =>
                    setTargetPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full h-11 px-4 rounded-sm bg-slate-950/90 border border-slate-700 focus:border-sky-400 focus:outline-none font-mono text-lg tracking-[0.25em] text-center text-white tabular-nums"
                />
              </div>

              <div className="sm:col-span-3 flex items-end">
                <button
                  onClick={() => connectToPeer()}
                  className="fluent-edge-btn w-full h-11 px-4 rounded-sm bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs border border-sky-400/50 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>اتصال مباشر</span>
                </button>
              </div>

              <div className="sm:col-span-3 flex items-end">
                <button
                  onClick={scannerOpen ? stopScanner : startScanner}
                  className="fluent-edge-btn w-full h-11 px-3 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs border border-slate-600 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Camera className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>{scannerOpen ? 'إغلاق الماسح' : 'مسح QR'}</span>
                </button>
              </div>
            </div>

            {/* نافذة ماسح الكاميرا المدمج عند تفعيله */}
            {scannerOpen && (
              <div className="mb-6 p-4 rounded-sm bg-slate-950/90 border border-sky-500/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-sky-300 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    <span>وجه الكاميرا نحو رمز الـ QR على الجهاز الآخر</span>
                  </span>
                  <button
                    onClick={stopScanner}
                    className="fluent-edge-btn p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {cameraError ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-sm text-xs text-amber-300 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full max-w-xs mx-auto aspect-square bg-black rounded-sm overflow-hidden border border-sky-500/40">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-6 border-2 border-sky-400/70 rounded-sm pointer-events-none" />
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <span>أو اختر صورة رمز QR من جهازك:</span>
                  <label className="fluent-edge-btn px-3 py-1.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 cursor-pointer">
                    <span>رفع صورة QR</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* منطقة سحب وإفلات الملفات والفيديوهات الكبيرة */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`fluent-edge-btn group cursor-pointer rounded-sm border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
                isDragging
                  ? 'border-sky-400 bg-sky-500/15'
                  : 'border-slate-600/80 hover:border-sky-400/80 bg-slate-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-sm bg-sky-500/15 border border-sky-400/30 flex items-center justify-center mx-auto mb-3 text-sky-400 group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">
                اضغط لاختيار ملفات أو فيديوهات، أو اسحبها وأفلتها هنا
              </h3>
              <p className="text-xs text-slate-400 mt-1.5">
                يدعم الفيديوهات الضخمة (MP4, MKV, MOV) والملفات المضغوطة والصور بأقصى سرعة لشبكة الـ Wi-Fi
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
                <span>تقسيم ذكي 64KB Chunking</span>
                <span aria-hidden="true">·</span>
                <span>دعم الإيقاف المؤقت والاستئناف</span>
                <span aria-hidden="true">·</span>
                <span>0% تخزين سحابي</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              نصيحة: يمكنك أيضاً تجربة إرسال أي ملف أو فيديو الآن مباشرة لمعاينة سرعة التقسيم ولوحة الملفات.
            </span>
            <button
              onClick={() => {
                setTargetPin(myPin);
                connectToPeer(myPin);
              }}
              className="text-sky-400 hover:text-sky-300 underline cursor-pointer font-medium"
            >
              تفعيل وضع الاختبار المحلي الفوري
            </button>
          </div>
        </FluentCard>
      </div>

      {/* قسم عمليات النقل الجارية والمكتملة مع أشرطة التقدم وأزرار الإيقاف المؤقت والاستئناف */}
      <FluentCard className="p-6">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              03. مراقب تدفق البيانات اللحظي (WebRTC DataChannel Monitor)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              يعرض الحجم المطلق، السرعة الفعلية بالميجابايت/ثانية، وشريط التقدم مع التحكم في تعليق واستئناف النقل
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            العمليات النشطة والمكتملة: {transfers.length}
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <FileVideo className="w-10 h-10 mx-auto mb-2.5 text-slate-500 opacity-75" />
            <p className="text-sm font-medium text-slate-300">
              لا توجد عمليات نقل جارية حالياً
            </p>
            <p className="text-xs text-slate-400 mt-1">
              اختر ملفاً أو مقطع فيديو من المربع أعلاه لبدء النقل المحلي المباشر
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((item) => {
              const progressPercent =
                item.fileSize > 0
                  ? Math.min(100, Math.round((item.transferredBytes / item.fileSize) * 100))
                  : 100;

              return (
                <div
                  key={`${item.id}-${item.direction}`}
                  className="p-4 rounded-sm bg-slate-900/80 border border-slate-700/70 transition-colors hover:border-sky-500/40"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${
                          item.direction === 'send'
                            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {item.direction === 'send' ? (
                          <ArrowUpLeft className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">
                            {item.fileName}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">
                            ({item.direction === 'send' ? 'إرسال' : 'استقبال'})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                          <span>
                            {formatBytes(item.transferredBytes)} / {formatBytes(item.fileSize)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            الأجزاء: {item.currentChunk}/{item.totalChunks}
                          </span>
                          {item.status === 'transferring' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-sky-400 font-semibold">
                                السرعة: {formatBytes(item.speedBytesPerSec)}/s
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* أزرار الإيقاف المؤقت / الاستئناف / الإلغاء وحالة النقل */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {item.status === 'completed' ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>اكتمل النقل 100%</span>
                        </span>
                      ) : item.status === 'cancelled' ? (
                        <span className="text-xs font-semibold text-rose-400">
                          تم الإلغاء
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => togglePauseTransfer(item.id)}
                            className="fluent-edge-btn flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 border border-slate-600 cursor-pointer"
                          >
                            {item.status === 'paused' ? (
                              <>
                                <Play className="w-3.5 h-3.5 text-emerald-400" />
                                <span>استئناف</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 text-amber-400" />
                                <span>إيقاف مؤقت</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => cancelTransfer(item.id)}
                            className="fluent-edge-btn p-1.5 rounded-sm bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 cursor-pointer"
                            title="إلغاء النقل"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* شريط التقدم الديناميكي */}
                  <div className="w-full h-2.5 bg-slate-950 rounded-sm overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-150 ${
                        item.status === 'completed'
                          ? 'bg-emerald-500'
                          : item.status === 'paused'
                          ? 'bg-amber-500'
                          : item.status === 'cancelled'
                          ? 'bg-rose-500'
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono tabular-nums">
                    <span>
                      {item.status === 'paused'
                        ? 'معلق مؤقتاً (يمكنك الاستئناف من نفس الجزء)'
                        : item.status === 'completed'
                        ? 'تم الحفظ في لوحة الملفات المستلمة'
                        : item.status === 'cancelled'
                        ? 'توقف النقل'
                        : 'جاري النقل المحلي المباشر...'}
                    </span>
                    <span className="font-bold text-slate-200">{progressPercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FluentCard>
    </div>
  );
};
