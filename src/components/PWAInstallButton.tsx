import React, { useState } from 'react';
import { Download, Smartphone, Monitor, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

/**
 * مكون زر تثبيت تطبيق الويب التقدمي (PWA)
 * يدعم التثبيت المباشر على Windows/Mac/Android ويعرض إرشادات التثبيت لمتصفحات iOS/Desktop
 */
export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // إذا كان التطبيق مثبتاً بالفعل ويعمل بشكل مستقل، نعرض شارة حالة التثبيت الهادئة
  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>مثبت على الجهاز</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="fluent-edge-btn flex items-center gap-2 px-4 py-2 rounded-sm bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold border border-sky-400/50 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
        title="تثبيت التطبيق على سطح المكتب أو الهاتف"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>تثبيت التطبيق (PWA)</span>
      </button>

      {/* نافذة إرشادات التثبيت عند عدم توفر الحدث التلقائي (مثل iOS Safari أو داخل إطار المعاينة) */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="fluent-edge-card w-full max-w-md rounded-sm p-6 text-right shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-sky-400" />
                <span>تثبيت التطبيق على جهازك (PWA)</span>
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="fluent-edge-btn p-1.5 rounded-sm text-slate-400 hover:text-white border border-transparent"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <div className="p-3.5 bg-slate-900/70 border border-slate-700/60 rounded-sm">
                <div className="flex items-center gap-2 font-semibold text-sky-300 mb-1.5">
                  <Monitor className="w-4 h-4" />
                  <span>على الكمبيوتر (Windows / Mac - Chrome & Edge):</span>
                </div>
                <p className="text-xs text-slate-300">
                  انقر على أيقونة <strong>تثبيت التطبيق (Install)</strong> الموجودة في الطرف الأيسر من شريط عنوان المتصفح (URL Bar) لتثبيته كتطبيق سطح مكتب مستقل.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900/70 border border-slate-700/60 rounded-sm">
                <div className="flex items-center gap-2 font-semibold text-sky-300 mb-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>
                    {isIOS
                      ? 'على أجهزة آيفون وآيباد (iOS Safari):'
                      : 'على الهواتف الذكية (Android & iOS):'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  1. اضغط على زر <strong>المشاركة (Share)</strong> أو قائمة المتصفح <strong>(⋮)</strong>.<br />
                  2. اختر <strong>الإضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> أو <strong>تثبيت التطبيق</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="fluent-edge-btn mt-5 w-full py-2.5 rounded-sm bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold border border-sky-400/40 cursor-pointer"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};
