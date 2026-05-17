import React, { useState } from 'react';
import { LogIn, AlertCircle, ShieldCheck, Globe, Monitor, Download } from 'lucide-react';
import { User, SystemSettings } from '../types';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (user: User) => void;
  settings: SystemSettings | null;
  installPrompt: any;
  onInstall: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, settings, installPrompt, onInstall }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedEmail = email.trim();
    const trimmedPassword = password; 
    
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      } catch (signInErr: any) {
        const isBootstrapError = signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential';
        
        if (trimmedEmail === 'kaleyapt@gmail.com' && isBootstrapError) {
          try {
            if (trimmedPassword === '123456') {
              try {
                userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
              } catch (createAuthErr: any) {
                if (createAuthErr.code === 'auth/email-already-in-use') {
                  throw signInErr;
                }
                throw createAuthErr;
              }
              
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                name: 'Administrador',
                email: 'kaleyapt@gmail.com',
                role: 'admin',
                created_at: new Date().toISOString()
              });
            } else {
              throw signInErr;
            }
          } catch (createErr: any) {
            console.error("Erro no bootstrap:", createErr);
            if (createErr.code === 'auth/email-already-in-use') {
              setError('O administrador já está registado, mas a senha está incorreta.');
            } else if (createErr.code === 'auth/operation-not-allowed') {
              setError('O login por E-mail/Senha não está ativado no Firebase Console.');
            } else {
              setError('Erro de acesso: ' + (createErr.message || 'Verifique suas credenciais.'));
            }
            return;
          }
        } else {
          throw signInErr;
        }
      }

      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        onLogin({ ...userData, id: userCredential.user.uid as any });
      } else {
        if (email === 'kaleyapt@gmail.com') {
          const adminData: User = {
            id: userCredential.user.uid,
            name: 'Administrador',
            email: 'kaleyapt@gmail.com',
            role: 'admin'
          };
          onLogin(adminData);
        } else {
          setError('Perfil de usuário não encontrado');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Usuário não encontrado');
      } else if (err.code === 'auth/invalid-email') {
        setError('O endereço de e-mail não é válido.');
      } else {
        setError('Erro ao fazer login: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        onLogin({ ...userData, id: userCredential.user.uid as any });
      } else {
        if (userCredential.user.email === 'kaleyapt@gmail.com') {
          const adminData: User = {
            id: userCredential.user.uid,
            name: userCredential.user.displayName || 'Administrador',
            email: 'kaleyapt@gmail.com',
            role: 'admin',
            photo: userCredential.user.photoURL || undefined
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            ...adminData,
            created_at: new Date().toISOString()
          });
          onLogin({ ...adminData, id: userCredential.user.uid as any });
        } else {
          setError('Apenas administradores podem aceder a este sistema neste momento.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao entrar com Google');
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = {
    '--primary': settings?.primaryColor || '#0f172a',
    '--secondary': settings?.secondaryColor || '#ffffff',
    '--accent': settings?.accentColor || '#fbbf24',
    '--bg-app': '#ffffff',
  } as React.CSSProperties;

  return (
    <div className="min-h-screen flex bg-slate-900 font-sans" style={dynamicStyles}>
      {/* Visual Side (Welcome Area) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 border-r border-white/5">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
          style={settings?.loginBackground ? { backgroundImage: `url(${settings.loginBackground})` } : { backgroundImage: 'url(https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80)' }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/60 to-transparent"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 p-16 flex flex-col justify-between h-full w-full"
        >
          <div>
            <div className="flex items-center gap-4 mb-16">
              <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl">
                {settings?.logo ? (
                  <img src={settings.logo} className="h-10 w-auto object-contain" alt="Logo" />
                ) : (
                  <ShieldCheck className="w-8 h-8" style={{ color: 'var(--accent)' }} />
                )}
              </div>
              <span className="text-2xl font-black text-white tracking-tight uppercase leading-none">
                {settings?.loginWelcomeLabel || settings?.systemName || 'Portal Consular'}
              </span>
            </div>
            
            <div className="max-w-md">
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-6xl font-black text-white leading-[1.1] mb-8"
              >
                {settings?.loginTitle || (
                  <>Bem-vindo ao Sistema de <span style={{ color: 'var(--accent)' }}>Emissão de Cartão</span> da Embaixada</>
                )}
              </motion.h1>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="h-1 w-20 mb-8 rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
              ></motion.div>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-slate-300 text-xl font-medium leading-relaxed"
              >
                {settings?.loginSubtitle || 'Plataforma oficial para gestão, verificação e personalização de identificações diplomáticas e consulares com autenticação biométrica integrada.'}
              </motion.p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-12 border-t border-white/10">
            <div className="flex gap-10">
              <div className="space-y-1">
                <span className="block text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Tecnologia</span>
                <span className="text-white/70 text-sm font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Cloud Secure
                </span>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Segurança</span>
                <span className="text-white/70 text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> AES-256
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Estado do Sistema: OK</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white overflow-y-auto relative">
        <div className="absolute top-8 right-8">
          <button 
            onClick={onInstall}
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-2xl transition-all hover:scale-110 active:scale-95",
              installPrompt 
                ? "text-white shadow-xl" 
                : "text-slate-400 bg-slate-50 border border-slate-100 opacity-80"
            )}
            style={installPrompt ? { backgroundColor: 'var(--primary)', boxShadow: `0 10px 30px -10px var(--primary)` } : {}}
            title="Versão Desktop"
          >
            <div className="relative">
              <Monitor className="w-5 h-5" />
              <Download className={cn("w-3 h-3 absolute -bottom-1 -right-1 rounded-full p-0.5 shadow-sm", installPrompt ? "bg-white text-slate-900" : "bg-slate-200 text-slate-500")} />
            </div>
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-12">
            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] shadow-xl flex items-center justify-center mx-auto mb-6 p-4 border border-slate-100">
              {settings?.logo ? (
                <img src={settings.logo} className="w-full h-full object-contain" alt="Logo" />
              ) : (
                <LogIn className="w-12 h-12 text-slate-900" />
              )}
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Emissão de Cartões</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-2">Bem-vindo à Embaixada</p>
          </div>

          <div className="hidden lg:block mb-12">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4 uppercase">Acesso ao Portal</h2>
            <div className="w-12 h-1 mb-4" style={{ backgroundColor: 'var(--accent)' }}></div>
            <p className="text-slate-500 text-lg font-medium">Introduza as suas credenciais de segurança para autenticar o acesso.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <motion.div 
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-red-50 text-red-600 p-5 rounded-2xl flex items-center gap-4 text-sm font-bold border border-red-100 shadow-sm"
              >
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                </div>
                {error}
              </motion.div>
            )}

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] ml-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-7 py-5 bg-slate-50/50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-8 focus:ring-slate-900 focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="exemplo@embaixada.gov"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] ml-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-7 py-5 bg-slate-50/50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-8 focus:ring-slate-900 focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-6 text-white rounded-[1.5rem] font-black shadow-[0_20px_50px_rgba(0,0,0,0.15)] transition-all flex items-center justify-center gap-4 disabled:opacity-50 group uppercase tracking-widest text-xs relative overflow-hidden active:scale-[0.98]"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {loading ? (
                <div className="w-6 h-6 border-[3px] border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar no Sistema
                  <LogIn className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-slate-50"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black">
                <span className="bg-white px-6 text-slate-300 tracking-widest italic">Procedimento Governamental</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-5 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-[1.5rem] font-black shadow-sm transition-all flex items-center justify-center gap-4 disabled:opacity-50 text-[10px] uppercase tracking-[0.2em]"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Login Conta Google
            </button>
          </form>

          <div className="mt-16 flex flex-col items-center gap-4 opacity-30">
            <div className="h-px w-12 bg-slate-300"></div>
            <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
              {settings?.loginFooterText || `© ${new Date().getFullYear()} Embaixada • Segurança Máxima`}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
