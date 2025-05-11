
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

export function AuthButtons() {
  const { user, loading, loginWithGoogle, logout } = useAuth();

  if (loading) {
    return <Button variant="ghost" size="sm" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</Button>;
  }

  if (user) {
    return (
      <Button variant="outline" size="sm" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={loginWithGoogle}>
      <LogIn className="mr-2 h-4 w-4" />
      Login
    </Button>
  );
}
