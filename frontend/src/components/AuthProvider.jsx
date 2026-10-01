"use client";

// AuthProvider — who is signed in, anywhere in the app (Stage 6).
//
// WHY THIS EXISTS INSTEAD OF ASKING EACH PAGE: the header needs the name, the
// checkout needs the token, and the admin link needs the role. Without one shared
// source, three screens would each open their own auth listener and flash
// different states while the session loads.
//
// THE IMPORTANT LIMIT: `role` here is for SHOWING things only (an "Admin" link,
// a different header). It is not security. Hiding a button does not stop anyone
// calling the route directly — the backend's `requireAdmin` is what actually
// blocks them, and it reads the role from the database, not from this context.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser, isAuthConfigured, signOut as supabaseSignOut } from "../lib/supabaseClient";
import { fetchMe } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // `loading` is true until the first session check finishes. Without it the
  // header would render "Sign in" for a moment on every page load and then
  // switch, even for someone who is already signed in.
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isAuthConfigured());
  const [role, setRole] = useState("customer");

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      // Not configured: not an error, just a site without sign-in. Guest
      // checkout still works, so nothing else needs to change.
      setLoading(false);
      return;
    }

    let active = true;

    // getSession() reads the token Supabase saved in local storage, so a signed-in
    // shopper stays signed in across visits without clicking anything.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

    // Keeps the session in sync with sign-in, sign-out and token refresh,
    // including in another tab. Without this, signing out in one tab would leave
    // the other tab looking signed in.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  // The ROLE is asked of the backend, never taken from the browser session, so
  // the UI and the server cannot disagree about who is an admin.
  useEffect(() => {
    let active = true;
    if (!user) {
      setRole("customer");
      return;
    }

    // Uses API_URL, not a relative path: in production the backend is on a
    // different origin (Netlify) from the frontend (Vercel), so "/auth/me" would
    // 404 against the frontend's own domain.
    fetchMe(session.access_token)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.role) setRole(data.role);
      })
      .catch(() => {
        // Leave the default role. A failure here must not sign anyone out or
        // break a page; it only means we cannot show the admin link, and the
        // admin routes would refuse this person anyway.
      });

    return () => {
      active = false;
    };
  }, [user, session?.access_token]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      role,
      isAdmin: role === "admin",
      // The raw token, passed to backend calls so it can verify who this is.
      accessToken: session?.access_token ?? null,
      signOut: async () => {
        await supabaseSignOut();
        setRole("customer");
      },
    }),
    [user, session, loading, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Always call this from inside a component that is under the provider. The error
// is explicit because returning null silently would hide a missing provider in
// layout.js until some unrelated screen appeared to break.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}