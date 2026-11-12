import { useEffect } from 'react';
import { getSession } from '../../lib/session';

// Someone who is already signed in has no use for the welcome page: send them to their dashboard.
export default function SessionRedirect() {
  useEffect(() => {
    if (getSession()?.token) window.location.replace('/dashboard');
  }, []);
  return null;
}
