// src/app/layout.js
import { Poppins, Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/AuthContext';
import '@/styles/globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Ativus — Organize. Planeje. Realize.',
  description: 'A plataforma completa de gestão de tarefas e projetos.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${inter.variable}`}>
      <body>
        {/* AuthProvider envolve tudo — qualquer página pode usar useAuth() */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
