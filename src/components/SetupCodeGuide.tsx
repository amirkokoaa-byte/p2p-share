import React, { useState } from 'react';
import { Terminal, Copy, Check, Globe, Shield, Cpu } from 'lucide-react';
import { FluentCard } from './FluentCard';

/**
 * مكون دليل الإعداد والنشر على GitHub Pages و Vercel
 * يوفر أوامر التثبيت والاعتماديات البرمجية جاهزة للنسخ المباشر
 */
export const SetupCodeGuide: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // تجاهل أخطاء الحافظة
    }
  };

  const setupCommands = `# 1. إنشاء مشروع React + TypeScript جديد عبر Vite
npm create vite@latest localshare-p2p -- --template react-ts
cd localshare-p2p

# 2. تثبيت حزم WebRTC (PeerJS)، رموز QR، والأيقونات والحركة
npm install peerjs qrcode.react jsqr lucide-react motion

# 3. تثبيت Tailwind CSS وإضافة تطبيق الويب التقدمي (Vite PWA)
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa

# 4. تشغيل خادم التطوير المحلي
npm run dev

# 5. بناء النسخة النهائية الثابتة الجاهزة للنشر على Vercel أو GitHub Pages
npm run build`;

  const vercelConfig = `{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}`;

  return (
    <div className="space-y-6">
      <FluentCard className="p-6">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-white">
              دليل الإعداد السريع والنشر (Vercel & GitHub Pages)
            </h2>
          </div>
          <button
            onClick={() => copyText('setup', setupCommands)}
            className="fluent-edge-btn flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-600 cursor-pointer"
          >
            {copiedId === 'setup' ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-sky-400" />
                <span>نسخ الأوامر</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-300 mb-3 leading-relaxed">
          يمكنك تشغيل هذا المشروع محلياً أو رفعه مباشرة إلى <strong>Vercel</strong> أو <strong>GitHub Pages</strong> كملفات ثابتة (Static Export) لأن نقل البيانات يتم بالكامل من المتصفح إلى المتصفح (P2P) عبر شبكة الـ Wi-Fi دون الحاجة لأي خادم خلفي لتخزين الملفات:
        </p>

        <pre
          dir="ltr"
          className="p-4 rounded-sm bg-slate-950 border border-slate-800 text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed"
        >
          {setupCommands}
        </pre>
      </FluentCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FluentCard className="p-6">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">إعداد ملف vercel.json</h3>
            </div>
            <button
              onClick={() => copyText('vercel', vercelConfig)}
              className="fluent-edge-btn flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-slate-800 text-xs text-slate-200 border border-slate-600 cursor-pointer"
            >
              {copiedId === 'vercel' ? (
                <span className="text-emerald-400">تم النسخ</span>
              ) : (
                <span>نسخ</span>
              )}
            </button>
          </div>
          <pre
            dir="ltr"
            className="p-4 rounded-sm bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto"
          >
            {vercelConfig}
          </pre>
        </FluentCard>

        <FluentCard className="p-6">
          <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3 mb-4">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              ضمانات الخصوصية والأمان المعماري
            </h3>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <Cpu className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>قناة مباشرة 100% (RTCDataChannel):</strong> تنتقل أجزاء الفيديو والملفات (64KB لكل جزء) عبر الشبكة المحلية مباشرة بين الجهازين بتشفير DTLS القياسي.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Cpu className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>انعدام التخزين السحابي (Zero Cloud Storage):</strong> لا يتم رفع أو حفظ أي ملف على أي قاعدة بيانات خارجية؛ جميع الملفات المستلمة تبقى داخل ذاكرة متصفحك المحلي.
              </span>
            </li>
          </ul>
        </FluentCard>
      </div>
    </div>
  );
};
