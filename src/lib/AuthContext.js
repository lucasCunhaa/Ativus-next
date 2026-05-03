// src/lib/AuthContext.js
// ════════════════════════════════════════════════════════════
//  Context de autenticação — compartilha o usuário logado
//  em todas as páginas sem precisar passar props manualmente
// ════════════════════════════════════════════════════════════

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuta mudanças de autenticação em tempo real
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    // Limpa o listener ao desmontar
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para consumir o contexto em qualquer componente
export function useAuth() {
  return useContext(AuthContext);
}
