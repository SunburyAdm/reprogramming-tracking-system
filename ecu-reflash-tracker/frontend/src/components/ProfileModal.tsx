import { useRef, useState } from 'react';
import { updateProfile } from '../services/api';
import { useAuthStore, User } from '../store/index';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { useT, useLangStore } from '../i18n';
import { usePrefsStore } from '../store';

interface Props {
  onClose: () => void;
}

// ── Palette of background colors for avatar initials ──────────────────────
const AVATAR_COLORS = [
  '#4f8ef7', '#7c3aed', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#db2777', '#0d9488', '#7c3aed', '#ea580c',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function pickColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Role badge ─────────────────────────────────────────────────────────────
const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  admin:  { bg: '#fef3c7', color: '#b45309' },
  tech:   { bg: '#dbeafe', color: '#1d4ed8' },
  viewer: { bg: '#f3f4f6', color: '#6b7280' },
};

// ── Avatar component ───────────────────────────────────────────────────────
function AvatarCircle({
  user, size = 80, onClick,
}: { user: User; size?: number; onClick?: () => void }) {
  const bg = user.avatar_color ?? pickColor(user.name);
  return (
    <div
      onClick={onClick}
      title={onClick ? 'Cambiar foto' : undefined}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: user.avatar ? 'transparent' : bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        border: '3px solid var(--border)',
        position: 'relative',
        fontSize: size * 0.38, fontWeight: 700, color: '#fff',
        userSelect: 'none',
      }}
    >
      {user.avatar ? (
        <img src={user.avatar} alt={user.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        getInitials(user.name)
      )}
      {onClick && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity .18s',
          fontSize: 22,
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
        >
          📷
        </div>
      )}
    </div>
  );
}

// ── Export helper so navbar can use it ─────────────────────────────────────
export { AvatarCircle, getInitials, pickColor };

// ── Main modal ─────────────────────────────────────────────────────────────
export default function ProfileModal({ onClose }: Props) {
  const { user, setUser } = useAuthStore();
  const { lang, setLang } = useLangStore();
  const { confirmReflash, setConfirmReflash } = usePrefsStore();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [name, setName]   = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  // Password fields
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  // UI state
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd]         = useState(false);
  const [profileMsg, setProfileMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdMsg, setPwdMsg]               = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return null;

  // ── Avatar upload ──────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 1.5 * 1024 * 1024; // 1.5 MB
    if (file.size > MAX) {
      setProfileMsg({ ok: false, text: t.photoTooLarge });
      return;
    }
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64 = ev.target?.result as string;
      try {
        const updated = await updateProfile({ avatar: base64 });
        setUser({ ...user, ...updated });
        setProfileMsg({ ok: true, text: t.photoUpdated });
      } catch {
        setProfileMsg({ ok: false, text: 'Error' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      const updated = await updateProfile({ avatar: '' });
      setUser({ ...user, ...updated });
      setProfileMsg({ ok: true, text: t.photoRemoved });
    } catch {
      setProfileMsg({ ok: false, text: 'Error' });
    }
  };

  // ── Save profile ───────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const updated = await updateProfile({
        name: name !== user.name ? name : undefined,
        email: email !== user.email ? email : undefined,
      });
      setUser({ ...user, ...updated });
      setProfileMsg({ ok: true, text: t.profileUpdated });
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Error';
      setProfileMsg({ ok: false, text: detail });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────
  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: t.passwordsNoMatch });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ ok: false, text: t.passwordTooShort });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      await updateProfile({ current_password: currentPwd, new_password: newPwd });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwdMsg({ ok: true, text: t.passwordChanged });
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Error';
      setPwdMsg({ ok: false, text: detail });
    } finally {
      setSavingPwd(false);
    }
  };

  const roleMeta = ROLE_STYLE[user.role] ?? ROLE_STYLE.viewer;
  const roleLabel = { admin: t.roleAdmin, tech: t.roleTech, viewer: t.roleViewer }[user.role] ?? user.role;
  const dateLocale = lang === 'es' ? esLocale : enUS;
  const datePattern = lang === 'es' ? "d 'de' MMMM yyyy" : 'MMMM d, yyyy';
  const joinedDate = user.created_at
    ? format(new Date(user.created_at), datePattern, { locale: dateLocale })
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 460, width: '100%', padding: 0, overflow: 'hidden' }}
      >
        {/* ── Header strip ─────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1a3a5c 0%, #2d5a8e 100%)',
          padding: '28px 28px 20px',
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ position: 'relative' }}>
            <AvatarCircle user={user} size={72} onClick={() => fileRef.current?.click()} />
            <input
              ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
              {user.email}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 99,
                fontSize: 12, fontWeight: 600,
                background: roleMeta.bg, color: roleMeta.color,
              }}>
                {roleLabel}
              </span>
              {joinedDate && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                  {t.joinedSince} {joinedDate}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,.7)', fontSize: 20,
              lineHeight: 1, alignSelf: 'flex-start',
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Avatar actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13, padding: '6px 14px' }}
              onClick={() => fileRef.current?.click()}
            >
              {t.changePhoto}
            </button>
            {user.avatar && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 13, padding: '6px 14px', color: 'var(--error)' }}
                onClick={handleRemoveAvatar}
              >
                {t.removePhoto}
              </button>
            )}
          </div>

          {/* ── Edit profile ─────────────────────────────────────────── */}
          <section>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14,
              color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.profileData}
            </h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{t.profileNameLabel}</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required minLength={2}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{t.profileEmailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {profileMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  background: profileMsg.ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                  color: profileMsg.ok ? 'var(--success)' : 'var(--error)',
                }}>
                  {profileMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '7px 20px', fontSize: 13 }}
                  disabled={savingProfile}
                >
                  {savingProfile ? t.saving : t.saveChanges}
                </button>
              </div>
            </form>
          </section>

          {/* ── Change password ──────────────────────────────────────── */}
          <section style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14,
              color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.changePassword}
            </h3>
            <form onSubmit={handleChangePwd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{t.currentPassword}</label>
                <input
                  type="password"
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>{t.newPasswordLabel}</label>
                  <input
                    type="password"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    autoComplete="new-password"
                    required minLength={6}
                    placeholder={t.minChars}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>{t.confirmNewPassword}</label>
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    autoComplete="new-password"
                    required minLength={6}
                    placeholder={t.repeatPwd}
                  />
                </div>
              </div>

              {pwdMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  background: pwdMsg.ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                  color: pwdMsg.ok ? 'var(--success)' : 'var(--error)',
                }}>
                  {pwdMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '7px 20px', fontSize: 13 }}
                  disabled={savingPwd}
                >
                  {savingPwd ? t.changingPassword : t.changePasswordBtn}
                </button>
              </div>
            </form>
          </section>

          {/* ── Workbench Preferences ──────────────────────────────── */}
          <section style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14,
              color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.prefWorkbench}
            </h3>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              cursor: 'pointer', padding: '10px 12px', borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)',
            }}>
              <input
                type="checkbox"
                checked={confirmReflash}
                onChange={e => setConfirmReflash(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {t.prefConfirmReflash}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  {t.prefConfirmReflashDesc}
                </div>
              </div>
            </label>
          </section>

          {/* ── Language ──────────────────────────────────────────────── */}
          <section style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14,
              color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.language}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setLang('en')}
                className={lang === 'en' ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '7px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🇺🇸 English
              </button>
              <button
                onClick={() => setLang('es')}
                className={lang === 'es' ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '7px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🇲🇽 Español
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
