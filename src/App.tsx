import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthGate } from './components/AuthGate';
import { ParentPortal } from './components/ParentPortal';
import { StudentPortal } from './components/StudentPortal';
import { TeacherPortal } from './components/TeacherPortal';
import { ADMIN_EMAIL, auth, googleProvider } from './lib/firebase';
import { fetchUserInvite, logActivity } from './services/instituteService';
import { InviteRecord, UserRole } from './types/institute';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [selectedPortal, setSelectedPortal] = useState<UserRole>('admin');
  const [invite, setInvite] = useState<InviteRecord | null>(null);
  const [inviteChecked, setInviteChecked] = useState(false);
  const [confirmedRole, setConfirmedRole] = useState<UserRole | null>(null);
  const pendingSignInLogRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setConfirmedRole(null);
      setInvite(null);

      if (!nextUser || !nextUser.email) {
        setInviteChecked(false);
        return;
      }

      const email = nextUser.email.toLowerCase();
      if (email === ADMIN_EMAIL && nextUser.emailVerified) {
        setInviteChecked(true);
        return;
      }

      setInviteChecked(false);
      try {
        const fetchedInvite = await fetchUserInvite(email);
        setInvite(fetchedInvite);
      } catch (err) {
        console.error('Failed to verify invite:', err);
        setInvite(null);
      } finally {
        setInviteChecked(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !user.email) return;
    const email = user.email.toLowerCase();
    const isAdminEmail = email === ADMIN_EMAIL && user.emailVerified;

    let resolvedRole: UserRole | null = null;
    let resolvedName = user.displayName || email;

    if (isAdminEmail) {
      resolvedRole = 'admin';
      resolvedName = user.displayName || 'Institute Admin';
    } else if (inviteChecked && invite && invite.status === 'active') {
      resolvedRole = invite.role;
      resolvedName = invite.displayName || user.displayName || email;
    }

    if (!resolvedRole) return;

    const sessionKey = `lni_login_logged_${user.uid}_${resolvedRole}`;
    const alreadyLoggedInSession = window.sessionStorage.getItem(sessionKey) === '1';

    if (pendingSignInLogRef.current || !alreadyLoggedInSession) {
      pendingSignInLogRef.current = false;
      window.sessionStorage.setItem(sessionKey, '1');
      const roleTitle = resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1);
      logActivity({
        category: 'login',
        action: `${roleTitle} Portal Login`,
        details: `${resolvedName} (${email}) authenticated into the ${roleTitle} Portal.`,
        actorName: resolvedName,
        actorEmail: email,
        actorRole: resolvedRole,
        targetLabel: `${roleTitle} Portal`,
      }).catch((err) => console.error('Activity login log error:', err));
    }
  }, [user, invite, inviteChecked]);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    pendingSignInLogRef.current = true;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      pendingSignInLogRef.current = false;
      const message =
        err instanceof Error ? err.message : 'Google sign-in could not be completed.';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (user) {
      (['admin', 'teacher', 'student', 'parent'] as UserRole[]).forEach((r) => {
        window.sessionStorage.removeItem(`lni_login_logged_${user.uid}_${r}`);
      });
    }
    await signOut(auth);
    setInvite(null);
    setInviteChecked(false);
    setConfirmedRole(null);
    setAuthError(null);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
          <p className="text-sm font-medium text-slate-600">Loading Leads Nexus Institute...</p>
        </div>
      </div>
    );
  }

  if (user && user.email) {
    const email = user.email.toLowerCase();
    const isAdminEmail = email === ADMIN_EMAIL && user.emailVerified;

    if (isAdminEmail && (selectedPortal === 'admin' || confirmedRole === 'admin')) {
      return <AdminDashboard user={user} onSignOut={handleSignOut} />;
    }

    if (
      !isAdminEmail &&
      inviteChecked &&
      invite &&
      invite.status === 'active' &&
      (selectedPortal === invite.role || confirmedRole === invite.role)
    ) {
      if (invite.role === 'teacher') {
        return <TeacherPortal user={user} invite={invite} onSignOut={handleSignOut} />;
      }
      if (invite.role === 'student') {
        return <StudentPortal user={user} invite={invite} onSignOut={handleSignOut} />;
      }
      if (invite.role === 'parent') {
        return <ParentPortal user={user} invite={invite} onSignOut={handleSignOut} />;
      }
    }
  }

  return (
    <AuthGate
      user={user}
      authLoading={authLoading}
      selectedPortal={selectedPortal}
      onSelectPortal={setSelectedPortal}
      invite={invite}
      inviteChecked={inviteChecked}
      authError={authError}
      onGoogleSignIn={handleGoogleSignIn}
      onSignOut={handleSignOut}
      confirmedRole={confirmedRole}
      onConfirmRoleOverride={(role) => {
        setSelectedPortal(role);
        setConfirmedRole(role);
      }}
    />
  );
}
