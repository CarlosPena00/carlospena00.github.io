// Thin auth wrappers around Supabase. Login is by real email + password,
// so "Confirm email" can stay ON (user clicks the confirmation link).
import { supabase } from "./supabase.js";

export function signUp(email, password) {
  return supabase.auth.signUp({ email: String(email).trim(), password });
}

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email: String(email).trim(), password });
}

export function signOut() {
  return supabase.auth.signOut();
}

export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// Calls back with the current user (or null) now and on every auth change.
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
}
