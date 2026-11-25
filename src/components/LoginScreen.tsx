import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Smartphone,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_LOGIN_PRESENTATION_SETTINGS,
  applyBackgroundOpacity,
  getLoginFontFamilyCss,
  isHexColorDark,
  type LoginPresentationSettings,
} from '../types/store';

export function LoginScreen({
  settings = DEFAULT_LOGIN_PRESENTATION_SETTINGS,
}: {
  settings?: LoginPresentationSettings;
}) {
  const {
    signInWithUsername,
    authError,
    clearAuthError,
  } = useAuth();
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setHeroImgFailed(false);
  }, [settings.heroImageUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithUsername(username, password);
    } finally {
      setSubmitting(false);
    }
  };

  const darkPanel = isHexColorDark(settings.panelBgColor);
  const darkAccent = isHexColorDark(settings.accentColor);
  const fontCss = getLoginFontFamilyCss(settings.fontStyle);

  const logoHeightClass =
    settings.logoSize === 'sm'
      ? 'h-7'
      : settings.logoSize === 'lg'
        ? 'h-14'
        : 'h-10';

  const headlineSizeClass =
    settings.headlineSize === 'compact'
      ? 'text-2xl sm:text-3xl'
      : settings.headlineSize === 'large'
        ? 'text-4xl sm:text-5xl'
        : 'text-3xl sm:text-4xl';

  return (
    <div
      className={`min-h-screen relative overflow-hidden flex flex-col ${
        settings.showHeroImage
          ? 'lg:grid lg:grid-cols-12 items-stretch'
          : 'items-center justify-center p-4 sm:p-8'
      }`}
      style={{
        background:
          'linear-gradient(135deg, #dbeafe 0%, #eef2ff 38%, #ecfeff 72%, #f3e8ff 100%)',
      }}
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none glass-atmosphere-orbs"
      />
      {/* Left / Main: Frosted Glass Authentication Panel */}
      <div
        className={`relative z-10 backdrop-blur-2xl backdrop-saturate-150 ${
          settings.showHeroImage
            ? `lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r ${
                darkPanel
                  ? 'border-white/15 shadow-[12px_0_40px_-14px_rgba(2,6,23,0.45)]'
                  : 'border-white/75 shadow-[12px_0_40px_-14px_rgba(15,23,42,0.12)]'
              }`
            : `w-full max-w-lg rounded-3xl border p-8 sm:p-12 ${
                darkPanel
                  ? 'border-white/15 shadow-[0_24px_60px_-16px_rgba(2,6,23,0.55)]'
                  : 'border-white/80 shadow-[0_24px_60px_-16px_rgba(15,23,42,0.16)]'
              }`
        }`}
        style={{
          background: applyBackgroundOpacity(
            settings.panelBgColor || '#ffffff',
            64
          ),
          fontFamily: fontCss,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {settings.showLogo && settings.logoDataUrl && (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandName || 'Logo'}
              className={`${logoHeightClass} w-auto object-contain shrink-0`}
            />
          )}
          {settings.showBrandName && (
            <span
              className="text-lg font-bold tracking-tight truncate"
              style={{ color: settings.textColor || '#0f172a' }}
            >
              {settings.brandName || 'TECNOVA'}
            </span>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="my-10 max-w-md space-y-6"
        >
          <h1
            className={`${headlineSizeClass} font-bold tracking-tight leading-[1.15]`}
            style={{
              textWrap: 'balance',
              color: settings.textColor || '#0f172a',
            }}
          >
            {settings.headline || DEFAULT_LOGIN_PRESENTATION_SETTINGS.headline}
          </h1>

          {settings.subtitle.trim() && (
            <p
              className="text-sm leading-relaxed"
              style={{
                color: darkPanel ? '#cbd5e1' : settings.textColor || '#475569',
                opacity: darkPanel ? 0.9 : 0.75,
              }}
            >
              {settings.subtitle}
            </p>
          )}

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-4 pt-1 font-sans"
          >
            <div>
              <label
                htmlFor="login-username"
                className={`block text-xs font-medium mb-1.5 ${
                  darkPanel ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  placeholder="ej. admin"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm text-slate-900 bg-white/70 backdrop-blur-md border border-white/80 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className={`block text-xs font-medium mb-1.5 ${
                  darkPanel ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm text-slate-900 bg-white/70 backdrop-blur-md border border-white/80 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-red-50/85 backdrop-blur-md border border-red-200/80 rounded-xl text-xs text-red-700 leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: submitting
                  ? '#94a3b8'
                  : settings.accentColor || '#0f172a',
                color: darkAccent || submitting ? '#ffffff' : '#0f172a',
              }}
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-semibold rounded-xl shadow-[0_12px_28px_-10px_rgba(15,23,42,0.45)] transition-all hover:opacity-95 hover:-translate-y-px disabled:cursor-not-allowed cursor-pointer"
            >
              <span>
                {submitting
                  ? 'Verificando...'
                  : settings.buttonLabel || 'Entrar al sistema'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </motion.div>

        <div />
      </div>

      {/* Right: Customizable Studio Retail Photography Showcase */}
      {settings.showHeroImage && (
        <div className="lg:col-span-7 relative z-10 min-h-[320px] lg:min-h-screen bg-slate-900 overflow-hidden">
          {heroImgFailed || !settings.heroImageUrl ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-400">
              <Smartphone className="w-16 h-16" />
            </div>
          ) : (
            <img
              src={settings.heroImageUrl}
              alt={settings.brandName || 'Presentación de tienda'}
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover"
            />
          )}

          {settings.heroCaption.trim() && (
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent flex items-end p-8 sm:p-12">
              <div className="max-w-lg text-white rounded-2xl bg-slate-950/55 backdrop-blur-xl border border-white/20 p-5 shadow-2xl">
                <p className="text-lg font-medium leading-snug">
                  {settings.heroCaption}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
