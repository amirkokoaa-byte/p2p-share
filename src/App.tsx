/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2,
  FolderKanban,
  Terminal,
  Menu,
  X,
  ShieldCheck,
  Wifi,
  Laptop,
} from 'lucide-react';
import { ReceivedFileItem } from './types';
import { ConnectionManager } from './components/ConnectionManager';
import { FileDashboard } from './components/FileDashboard';
import { SetupCodeGuide } from './components/SetupCodeGuide';
import { PWAInstallButton } from './components/PWAInstallButton';
import { FluentCard } from './components/FluentCard';
import { LiveClock } from './components/LiveClock';

type ActiveSection = 'transfer' | 'files' | 'guide';

/**
 * المكون الرئيسي للتطبيق (App.tsx)
 * يضم الشريط الإخباري العلوي المتحرك (Marquee)، الساعة الحية المعزولة في أعلى اليسار بنظام 12 ساعة،
 * القائمة الجانبية المتجاوبة بنمط Windows 10 Fluent Design، ومحرك النقل المحلي WebRTC.
 */
export default function App() {
  // القسم النشط حالياً في لوحة العمل
  const [activeSection, setActiveSection] = useState<ActiveSection>('transfer');

  // حالة فتح/إغلاق القائمة الجانبية على شاشات الهاتف (مخفية افتراضياً على الجوال)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // قائمة الملفات والفيديوهات المستلمة محلياً
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFileItem[]>([]);

  // إغلاق القائمة الجانبية تلقائياً على الهاتف عند النقر في أي مكان خارجها
  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsMobileSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isMobileSidebarOpen]);

  // إضافة ملف مستلم جديد إلى لوحة الملفات (مغلفة بـ useCallback لضمان استقرار المرجع)
  const handleFileReceived = useCallback((file: ReceivedFileItem) => {
    setReceivedFiles((prev) => [file, ...prev]);
  }, []);

  // تبديل حالة تحديد ملف واحد
  const handleToggleSelect = useCallback((id: string) => {
    setReceivedFiles((prev) =>
      prev.map((file) =>
        file.id === id ? { ...file, selected: !file.selected } : file
      )
    );
  }, []);

  // تحديد أو إلغاء تحديد جميع الملفات المستلمة
  const handleSelectAll = useCallback(() => {
    setReceivedFiles((prev) => {
      const allSelected = prev.length > 0 && prev.every((f) => f.selected);
      return prev.map((file) => ({ ...file, selected: !allSelected }));
    });
  }, []);

  // حذف الملفات المحددة من الواجهة المحلية وتحرير عناوين الذاكرة المؤقتة (Blob URLs)
  const handleDeleteSelected = useCallback(() => {
    setReceivedFiles((prev) => {
      prev.forEach((file) => {
        if (file.selected && file.blobUrl) {
          URL.revokeObjectURL(file.blobUrl);
        }
      });
      return prev.filter((file) => !file.selected);
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0A1128] text-slate-100 select-none sm:select-auto">
      {/* 1. الشريط الإخباري العلوي المتحرك باستمرار بسرعة متوسطة (Top Continuous Marquee) */}
      <div className="w-full bg-slate-950/95 border-b border-sky-500/30 py-2 overflow-hidden relative z-30">
        <div className="animate-marquee-medium flex items-center gap-12 text-xs font-medium text-sky-200 whitespace-nowrap px-4">
          <span>
            مرحباً بك في نظام LocalShare P2P — نقل محلي مباشر للملفات والفيديوهات الضخمة عبر شبكة الـ Wi-Fi بسرعة قصوى وبدون أي خوادم تخزين وسيطة
          </span>
          <span aria-hidden="true">·</span>
          <span>
            خصوصية تامة 100%: تنتقل جميع البيانات من المتصفح إلى المتصفح مباشرة عبر قناة WebRTC DataChannel المشفرة
          </span>
          <span aria-hidden="true">·</span>
          <span>
            نصيحة الاستخدام: يمكنك الإقران الفوري عبر مسح رمز الـ QR بالكاميرا أو إدخال رمز الـ PIN المكون من 6 أرقام، مع دعم الإيقاف المؤقت والاستئناف أثناء النقل
          </span>
          <span aria-hidden="true">·</span>
          <span>
            يدعم التثبيت كتطبيق مستقل (PWA) على أنظمة Windows و Mac و Android و iOS للعمل في أي وقت
          </span>
        </div>
      </div>

      {/* 2. الشريط العلوي أسفل الـ Marquee: يضم الساعة الحية في أقصى اليسار (Top-Left Live Clock) وعناصر التحكم */}
      <header className="w-full bg-slate-900/75 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* الجهة اليمنى: زر القائمة الجانبية للجوال + اسم وهوية التطبيق */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="fluent-edge-btn lg:hidden p-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-600/80 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="فتح القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-400 font-bold">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
                  LocalShare P2P
                </h1>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  نقل محلي فائق السرعة بنمط Windows 10 Fluent Design
                </p>
              </div>
            </div>
          </div>

          {/* الجهة اليسرى (Top-Left below Marquee): الساعة الحية بنظام 12 ساعة مع AM/PM + زر تثبيت PWA */}
          <div className="flex items-center gap-3 mr-auto sm:mr-0">
            <PWAInstallButton />
            <LiveClock />
          </div>
        </div>
      </header>

      {/* 3. الهيكل الرئيسي: القائمة الجانبية المتجاوبة (Sidebar) + منطقة العمل الرئيسية */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto relative">
        {/* القائمة الجانبية الثابتة على سطح المكتب (Desktop Sidebar) */}
        <aside className="hidden lg:flex flex-col w-68 shrink-0 border-l border-slate-800/90 bg-slate-900/50 backdrop-blur-md p-4 justify-between">
          <div className="space-y-2">
            <div className="px-3 py-2 text-xs font-semibold text-slate-400 border-b border-slate-800 mb-3">
              لوحة التنقل الرئيسية
            </div>

            <button
              onClick={() => setActiveSection('transfer')}
              className={`fluent-edge-btn w-full flex items-center justify-between px-4 py-3 rounded-sm text-sm font-semibold border cursor-pointer ${
                activeSection === 'transfer'
                  ? 'bg-sky-600/25 text-white border-sky-400/70'
                  : 'bg-slate-900/40 text-slate-300 border-transparent hover:bg-slate-800/70'
              }`}
            >
              <span className="flex items-center gap-3">
                <Share2 className="w-4 h-4 text-sky-400" />
                <span>الاتصال ونقل الملفات</span>
              </span>
            </button>

            <button
              onClick={() => setActiveSection('files')}
              className={`fluent-edge-btn w-full flex items-center justify-between px-4 py-3 rounded-sm text-sm font-semibold border cursor-pointer ${
                activeSection === 'files'
                  ? 'bg-sky-600/25 text-white border-sky-400/70'
                  : 'bg-slate-900/40 text-slate-300 border-transparent hover:bg-slate-800/70'
              }`}
            >
              <span className="flex items-center gap-3">
                <FolderKanban className="w-4 h-4 text-sky-400" />
                <span>إدارة الملفات المستلمة</span>
              </span>
              <span className="font-mono text-xs text-sky-300 tabular-nums">
                ({receivedFiles.length})
              </span>
            </button>

            <button
              onClick={() => setActiveSection('guide')}
              className={`fluent-edge-btn w-full flex items-center justify-between px-4 py-3 rounded-sm text-sm font-semibold border cursor-pointer ${
                activeSection === 'guide'
                  ? 'bg-sky-600/25 text-white border-sky-400/70'
                  : 'bg-slate-900/40 text-slate-300 border-transparent hover:bg-slate-800/70'
              }`}
            >
              <span className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-sky-400" />
                <span>دليل الإعداد والنشر</span>
              </span>
            </button>
          </div>

          {/* بطاقة معلومات الأمان في أسفل القائمة الجانبية */}
          <FluentCard className="p-4 mt-6">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>اتصال P2P مشفر 100%</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              لا يتم تخزين أي ملف أو فيديو على أي خادم خارجي. جميع عمليات النقل تتم مباشرة عبر شبكة الـ Wi-Fi المحلية.
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5 text-sky-400" />
                <span>Windows 10 Fluent</span>
              </span>
              <span className="font-mono text-sky-400">WebRTC v2</span>
            </div>
          </FluentCard>
        </aside>

        {/* القائمة الجانبية المنزلقة على شاشات الهاتف (تُغلق تلقائياً عند النقر في أي مكان خارجها) */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs lg:hidden flex"
            >
              <motion.aside
                ref={sidebarRef}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-72 max-w-[82vw] h-full bg-[#0D1733]/95 backdrop-blur-xl border-l border-sky-500/30 p-5 flex flex-col justify-between shadow-2xl"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-700/70 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-5 h-5 text-sky-400" />
                      <span className="font-bold text-base text-white">
                        قائمة LocalShare
                      </span>
                    </div>
                    <button
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="fluent-edge-btn p-2 rounded-sm bg-slate-800 text-slate-300 hover:text-white border border-slate-600 min-h-[40px] min-w-[40px] flex items-center justify-center"
                      aria-label="إغلاق القائمة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      onClick={() => {
                        setActiveSection('transfer');
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`fluent-edge-btn w-full flex items-center justify-between px-4 py-3.5 rounded-sm text-sm font-semibold border ${
                        activeSection === 'transfer'
                          ? 'bg-sky-600/30 text-white border-sky-400'
                          : 'bg-slate-900/60 text-slate-300 border-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Share2 className="w-4 h-4 text-sky-400" />
                        <span>الاتصال ونقل الملفات</span>
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveSection('files');
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`fluent-edge-btn w-full flex items-center justify-between px-4 py-3.5 rounded-sm text-sm font-semibold border ${
                        activeSection === 'files'
                          ? 'bg-sky-600/30 text-white border-sky-400'
                          : 'bg-slate-900/60 text-slate-300 border-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <FolderKanban className="w-4 h-4 text-sky-400" />
                        <span>إدارة الملفات المستلمة</span>
                      </span>
                      <span className="font-mono text-xs text-sky-300">
                        ({receivedFiles.length})
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveSection('guide');
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`fluent-edge-btn w-full flex items-center justify-between px-4 py-3.5 rounded-sm text-sm font-semibold border ${
                        activeSection === 'guide'
                          ? 'bg-sky-600/30 text-white border-sky-400'
                          : 'bg-slate-900/60 text-slate-300 border-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Terminal className="w-4 h-4 text-sky-400" />
                        <span>دليل الإعداد والنشر</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-sm bg-slate-900/90 border border-slate-700/70 text-xs text-slate-400">
                  انقر في أي مكان خارج القائمة لإغلاقها تلقائياً.
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        {/* منطقة المحتوى الرئيسية: إبقاء ConnectionManager نشطاً في الذاكرة حتى عند التبديل بين التبويبات لعدم قطع الاتصال */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <div className={activeSection === 'transfer' ? 'block' : 'hidden'}>
            <ConnectionManager
              onFileReceived={handleFileReceived}
              receivedCount={receivedFiles.length}
              onNavigateToFiles={() => setActiveSection('files')}
            />
          </div>

          {activeSection === 'files' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
            >
              <FileDashboard
                files={receivedFiles}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDeleteSelected={handleDeleteSelected}
              />
            </motion.div>
          )}

          {activeSection === 'guide' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
            >
              <SetupCodeGuide />
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
