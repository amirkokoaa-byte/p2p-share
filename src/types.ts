/**
 * تعريف الأنواع والواجهات البرمجية لتطبيق النقل المحلي المباشر (LocalShare P2P)
 * جميع البيانات تُعالج محلياً عبر الذاكرة وقنوات WebRTC دون أي تخزين خارجي
 */

// حالة الاتصال بين الجهازين
export type ConnectionStatus = 'disconnected' | 'ready' | 'connecting' | 'connected' | 'error';

// حالة عملية نقل الملف الواحد
export type TransferStatus = 'transferring' | 'paused' | 'completed' | 'cancelled' | 'error';

// اتجاه عملية النقل (إرسال أو استقبال)
export type TransferDirection = 'send' | 'receive';

// نموذج بيانات عملية نقل ملف جارية أو مكتملة
export interface FileTransferItem {
  id: string;
  fileName: string;
  fileSize: number; // الحجم المطلق بالبايت
  fileType: string;
  direction: TransferDirection;
  transferredBytes: number;
  speedBytesPerSec: number; // سرعة النقل اللحظية بالبايت/ثانية
  status: TransferStatus;
  totalChunks: number;
  currentChunk: number;
  startedAt: number;
  blobUrl?: string;
}

// نموذج بيانات الملف المستلم داخل لوحة إدارة الملفات
export interface ReceivedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  blobUrl: string;
  receivedAt: string;
  selected: boolean;
}

// رسائل البروتوكول المتبادلة عبر قناة البيانات (RTCDataChannel)
export type SignalingDataPacket =
  | {
      type: 'HANDSHAKE_SYN';
      senderPin: string;
    }
  | {
      type: 'HANDSHAKE_ACK';
      senderPin: string;
    }
  | {
      type: 'PING';
      timestamp: number;
    }
  | {
      type: 'PONG';
      timestamp: number;
    }
  | {
      type: 'FILE_META';
      transferId: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      totalChunks: number;
    }
  | {
      type: 'FILE_CHUNK';
      transferId: string;
      chunkIndex: number;
      data: ArrayBuffer | Uint8Array | string; // يدعم Binary ArrayBuffer أو Base64 لضمان التوافق بين كافة المتصفحات
    }
  | {
      type: 'TRANSFER_CONTROL';
      transferId: string;
      action: 'PAUSE' | 'RESUME' | 'CANCEL';
    }
  | {
      type: 'FILE_COMPLETE';
      transferId: string;
    };
