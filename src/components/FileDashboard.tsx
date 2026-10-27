import React, { useState } from 'react';
import {
  Film,
  Image as ImageIcon,
  FileAudio,
  FileText,
  Trash2,
  Download,
  Play,
  CheckSquare,
  Square,
  X,
  FolderOpen,
} from 'lucide-react';
import { ReceivedFileItem } from '../types';
import { formatBytes } from './ConnectionManager';
import { FluentCard } from './FluentCard';

interface FileDashboardProps {
  files: ReceivedFileItem[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
}

/**
 * لوحة إدارة الملفات والفيديوهات المستلمة (File Management Dashboard)
 * تتيح تحديد الكل (Select All)، حذف الملفات المحددة من الواجهة المحلية، والمعاينة/التشغيل المحلي المباشر
 */
export const FileDashboard: React.FC<FileDashboardProps> = ({
  files,
  onToggleSelect,
  onSelectAll,
  onDeleteSelected,
}) => {
  // الملف المفتوح حالياً للمعاينة أو التشغيل المحلي
  const [previewFile, setPreviewFile] = useState<ReceivedFileItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'video' | 'image' | 'other'>('all');

  const allSelected = files.length > 0 && files.every((f) => f.selected);
  const selectedCount = files.filter((f) => f.selected).length;

  const filteredFiles = files.filter((f) => {
    if (filterType === 'all') return true;
    if (filterType === 'video') return f.type.startsWith('video/');
    if (filterType === 'image') return f.type.startsWith('image/');
    return !f.type.startsWith('video/') && !f.type.startsWith('image/');
  });

  // اختيار أيقونة مناسبة لنوع الملف
  const getFileIcon = (mime: string) => {
    if (mime.startsWith('video/')) return <Film className="w-6 h-6 text-sky-400" />;
    if (mime.startsWith('image/')) return <ImageIcon className="w-6 h-6 text-emerald-400" />;
    if (mime.startsWith('audio/')) return <FileAudio className="w-6 h-6 text-amber-400" />;
    return <FileText className="w-6 h-6 text-slate-300" />;
  };

  return (
    <div className="space-y-6">
      {/* شريط الأدوات العلوي: تحديد الكل، تصفية الأنواع، وحذف المحدد */}
      <FluentCard className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              لوحة إدارة الملفات والفيديوهات المستلمة
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              جميع الملفات محفوظة محلياً في ذاكرة متصفحك فقط — يمكنك تشغيل الفيديوهات أو تنزيلها أو حذفها
            </p>
          </div>

          {/* أزرار التصفية حسب نوع الملف */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-sm border border-slate-800">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({files.length})
            </button>
            <button
              onClick={() => setFilterType('video')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                filterType === 'video'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              فيديوهات ({files.filter((f) => f.type.startsWith('video/')).length})
            </button>
            <button
              onClick={() => setFilterType('image')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                filterType === 'image'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              صور ({files.filter((f) => f.type.startsWith('image/')).length})
            </button>
            <button
              onClick={() => setFilterType('other')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                filterType === 'other'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              مستندات وأخرى
            </button>
          </div>
        </div>

        {/* شريط التحكم في التحديد والحذف الجماعي */}
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onSelectAll}
            disabled={files.length === 0}
            className="fluent-edge-btn flex items-center gap-2 px-3.5 py-2 rounded-sm bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/70 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-sky-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>تحديد الكل ({files.length})</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              المحدد: {selectedCount} ملف
            </span>
            <button
              onClick={onDeleteSelected}
              disabled={selectedCount === 0}
              className="fluent-edge-btn flex items-center gap-1.5 px-4 py-2 rounded-sm bg-rose-600/25 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المحدد ({selectedCount})</span>
            </button>
          </div>
        </div>
      </FluentCard>

      {/* شبكة عرض الملفات المستلمة */}
      {filteredFiles.length === 0 ? (
        <FluentCard className="p-12 text-center">
          <FolderOpen className="w-12 h-12 mx-auto text-slate-500 mb-3 opacity-75" />
          <h3 className="text-base font-bold text-slate-200">
            لا توجد ملفات مستلمة في هذا القسم حتى الآن
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            عند استقبال أي فيديو أو ملف عبر قناة WebRTC المحلية، سيظهر هنا فوراً مع إمكانية تشغيله أو حفظه على جهازك.
          </p>
        </FluentCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFiles.map((file) => {
            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');

            return (
              <FluentCard
                key={file.id}
                className={`p-4 flex flex-col justify-between transition-all ${
                  file.selected ? 'border-sky-400 bg-sky-950/25' : ''
                }`}
              >
                <div>
                  {/* رأس البطاقة: مربع الاختيار + اسم الملف */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <button
                      onClick={() => onToggleSelect(file.id)}
                      className="flex items-center gap-2.5 text-right min-w-0 cursor-pointer group"
                    >
                      {file.selected ? (
                        <CheckSquare className="w-5 h-5 text-sky-400 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 group-hover:text-slate-200 shrink-0" />
                      )}
                      <span className="text-sm font-bold text-white truncate">
                        {file.name}
                      </span>
                    </button>
                    {getFileIcon(file.type)}
                  </div>

                  {/* معاينة مصغرة للفيديو أو الصورة */}
                  <div
                    onClick={() => setPreviewFile(file)}
                    className="relative w-full h-40 rounded-sm bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center cursor-pointer group mb-3"
                  >
                    {isVideo ? (
                      <>
                        <video
                          src={file.blobUrl}
                          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                          <div className="w-11 h-11 rounded-full bg-sky-500/90 text-white flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 fill-current" />
                          </div>
                        </div>
                      </>
                    ) : isImage ? (
                      <img
                        src={file.blobUrl}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="text-center p-4">
                        {getFileIcon(file.type)}
                        <span className="block text-xs text-slate-400 mt-2">
                          اضغط للمعاينة أو التنزيل
                        </span>
                      </div>
                    )}
                  </div>

                  {/* بيانات الملف: الحجم المطلق ووقت الاستلام */}
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums mb-4">
                    <span>الحجم: {formatBytes(file.size)}</span>
                    <span>{file.receivedAt}</span>
                  </div>
                </div>

                {/* أزرار التشغيل المحلي والتنزيل المباشر */}
                <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-700/60">
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="fluent-edge-btn flex items-center justify-center gap-1.5 py-2 px-3 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-600 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isVideo ? 'تشغيل الفيديو' : 'معاينة محلية'}</span>
                  </button>

                  <a
                    href={file.blobUrl}
                    download={file.name}
                    className="fluent-edge-btn flex items-center justify-center gap-1.5 py-2 px-3 rounded-sm bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold border border-sky-400/50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل للجهاز</span>
                  </a>
                </div>
              </FluentCard>
            );
          })}
        </div>
      )}

      {/* نافذة تشغيل الفيديو والمعاينة المحلية (Local Media Playback Modal) */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="fluent-edge-card w-full max-w-3xl rounded-sm p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">
                  {previewFile.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  {formatBytes(previewFile.size)} · {previewFile.type}
                </p>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="fluent-edge-btn p-1.5 rounded-sm bg-slate-800 text-slate-300 hover:text-white border border-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 rounded-sm border border-slate-800 overflow-hidden flex items-center justify-center max-h-[65vh]">
              {previewFile.type.startsWith('video/') ? (
                <video
                  src={previewFile.blobUrl}
                  controls
                  autoPlay
                  className="w-full max-h-[62vh] object-contain"
                />
              ) : previewFile.type.startsWith('image/') ? (
                <img
                  src={previewFile.blobUrl}
                  alt={previewFile.name}
                  className="max-w-full max-h-[62vh] object-contain"
                />
              ) : previewFile.type.startsWith('audio/') ? (
                <div className="p-10 w-full">
                  <audio src={previewFile.blobUrl} controls autoPlay className="w-full" />
                </div>
              ) : (
                <div className="p-12 text-center text-slate-300">
                  <FileText className="w-12 h-12 mx-auto text-sky-400 mb-3" />
                  <p className="text-sm font-semibold">
                    ملف جاهز للحفظ المباشر على جهازك ({formatBytes(previewFile.size)})
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <a
                href={previewFile.blobUrl}
                download={previewFile.name}
                className="fluent-edge-btn flex items-center gap-2 px-5 py-2.5 rounded-sm bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold border border-sky-400/50"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل وحفظ الملف</span>
              </a>
              <button
                onClick={() => setPreviewFile(null)}
                className="fluent-edge-btn px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
