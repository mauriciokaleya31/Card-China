import { useState, useEffect, useMemo } from 'react';
import { IDForm } from './components/IDForm';
import { IDList } from './components/IDList';
import { TemplateSettings } from './components/TemplateSettings';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { cn } from './lib/utils';
import { IDCardData, User, SystemSettings } from './types';
import { Plus, List, ShieldCheck, Download, Settings, LayoutDashboard, LogOut, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  query, 
  orderBy,
  setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [view, setView] = useState<'form' | 'list' | 'settings' | 'admin'>('form');
  const [cards, setCards] = useState<IDCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubCards: (() => void) | null = null;

    // Listen to Auth
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous listeners
      if (unsubUser) unsubUser();
      if (unsubCards) unsubCards();

      if (firebaseUser) {
        // Fetch user data from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubUser = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            setUser({ ...snapshot.data(), id: firebaseUser.uid as any } as User);
          } else if (firebaseUser.email === 'kaleyapt@gmail.com') {
            // Bootstrap first admin if doc doesn't exist yet
            setUser({ id: firebaseUser.uid, name: 'Administrador', email: 'kaleyapt@gmail.com', role: 'admin' });
          }
        });

        // Listen to Cards (only when authenticated)
        const q = query(collection(db, 'id_cards'), orderBy('created_at', 'desc'));
        unsubCards = onSnapshot(q, (snapshot) => {
          const mappedData = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id as any
          } as IDCardData));
          setCards(mappedData);
        }, (error) => {
          console.error("Firestore error (cards):", error);
        });
      } else {
        setUser(null);
        setCards([]);
      }
    });

    // Listen to Settings (publicly readable)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SystemSettings);
      }
    }, (error) => {
      // If permission denied, it's likely rules haven't been deployed or user is logged out (though it should be public)
      console.warn("Firestore settings access restricted. Check your security rules.", error);
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });

    return () => {
      unsubAuth();
      unsubSettings();
      if (unsubUser) unsubUser();
      if (unsubCards) unsubCards();
    };
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    if (userData.role === 'admin') {
      setView('admin');
    } else {
      setView('form');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setView('form');
  };

  const hasPermission = (perm: string) => {
    if (user?.role === 'admin') return true;
    return user?.permissions?.includes(perm);
  };

  const handleSave = async (data: IDCardData) => {
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'id_cards'), {
        ...data,
        created_at: new Date().toISOString(),
        created_by_id: user.id,
        created_by_name: user.name
      });
      alert('Cartão gerado e guardado com sucesso no Firebase!');
      setView('list');
    } catch (error) {
      console.error(error);
      alert('Erro ao guardar cartão no Firebase. Verifique as permissões.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que deseja eliminar este registo?')) return;
    try {
      await deleteDoc(doc(db, 'id_cards', id));
    } catch (error) {
      console.error("Erro ao eliminar cartão:", error);
    }
  };

  const dynamicStyles = useMemo(() => ({
    '--primary': settings?.primaryColor || '#0f172a',
    '--secondary': settings?.secondaryColor || '#ffffff',
    '--accent': settings?.accentColor || '#fbbf24',
    '--bg-app': settings?.backgroundColor || '#f8fafc',
    '--font-h': settings?.headingFont || '"Inter", sans-serif',
    '--font-b': settings?.bodyFont || '"Inter", sans-serif',
  } as React.CSSProperties), [settings]);

  // Inject Custom Font if exists
  useEffect(() => {
    if (settings?.customFontName && settings?.customFontData) {
      const styleId = 'custom-font-style';
      let styleTag = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        @font-face {
          font-family: '${settings.customFontName}';
          src: url('${settings.customFontData}');
        }
      `;
    }
  }, [settings?.customFontName, settings?.customFontData]);

  const handleInstall = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    } else {
      alert('Para instalar a Versão Desktop:\n\n1. Esta funcionalidade pode não estar disponível dentro da pré-visualização. Clique no botão "Abrir numa nova aba" no topo do editor.\n2. Na nova aba, verifique o ícone de computador/instalação na barra de endereço do navegador.\n3. Se não aparecer, verifique se o navegador suporta PWAs (Chrome, Edge ou Safari recomendado).');
    }
  };

  if (!user) {
    return (
      <div style={dynamicStyles}>
        <Login onLogin={handleLogin} settings={settings} installPrompt={installPrompt} onInstall={handleInstall} />
      </div>
    );
  }

  if (user.role === 'admin' && view === 'admin') {
    return (
      <div style={dynamicStyles}>
        <AdminDashboard 
          onLogout={handleLogout} 
          onGoToIssuance={() => setView('form')} 
          installPrompt={installPrompt}
          onInstall={handleInstall}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={dynamicStyles}>
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 h-28 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.logo && settings.logo.trim() !== '' ? (
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-slate-100">
                <img src={settings.logo} className="w-full h-full object-contain" alt="Logo" />
              </div>
            ) : (
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                style={{ backgroundColor: settings?.primaryColor || '#000000' }}
              >
                <ShieldCheck className="text-white w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="font-black text-2xl tracking-tighter leading-none" style={{ color: settings?.primaryColor || '#000000' }}>
                {settings?.systemName || 'EMBAIXADA DIGITAL'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-8 h-1" style={{ backgroundColor: settings?.accentColor || '#fbbf24' }}></div>
                {isOffline && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded">Offline</span>
                )}
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {hasPermission('can_create_cards') && (
              <button 
                onClick={() => setView('form')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                  view === 'form' ? "bg-white shadow-xl scale-[1.02]" : "text-slate-400 hover:text-slate-900"
                )}
                style={view === 'form' ? { color: settings?.primaryColor || '#000000' } : {}}
              >
                <Plus className="w-4 h-4" /> NOVO CARTÃO
              </button>
            )}
            {hasPermission('can_view_records') && (
              <button 
                onClick={() => setView('list')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                  view === 'list' ? "bg-white shadow-xl scale-[1.02]" : "text-slate-400 hover:text-slate-900"
                )}
                style={view === 'list' ? { color: settings?.primaryColor || '#000000' } : {}}
              >
                <List className="w-4 h-4" /> REGISTOS
              </button>
            )}
            {hasPermission('can_manage_templates') && (
              <button 
                onClick={() => setView('settings')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                  view === 'settings' ? "bg-white shadow-xl scale-[1.02]" : "text-slate-400 hover:text-slate-900"
                )}
                style={view === 'settings' ? { color: settings?.primaryColor || '#000000' } : {}}
              >
                <Settings className="w-4 h-4" /> MODELOS
              </button>
            )}
          </nav>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleInstall}
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-xl transition-all hover:scale-110 active:scale-95",
                  installPrompt 
                    ? "text-white shadow-xl" 
                    : "text-slate-400 bg-slate-50 border border-slate-100 opacity-80"
                )}
                style={installPrompt ? { backgroundColor: 'var(--primary)', boxShadow: `0 10px 20px -5px var(--primary)` } : {}}
                title="Versão Desktop"
              >
                <div className="relative">
                  <Monitor className="w-5 h-5" style={{ color: installPrompt ? 'white' : 'var(--accent)' }} />
                  <Download className={cn("w-3 h-3 absolute -bottom-1 -right-1 rounded-full p-0.5 shadow-sm", installPrompt ? "bg-white text-slate-900" : "bg-slate-200 text-slate-500")} />
                </div>
              </button>
              
              {!installPrompt && (
                <div className="group relative">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 cursor-help border border-slate-200">?</div>
                  <div className="absolute top-full right-0 mt-3 w-72 p-6 bg-white rounded-2xl shadow-2xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] scale-95 group-hover:scale-100">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Monitor className="w-4 h-4 text-slate-900" />
                        <h4 className="text-[12px] font-black text-slate-900 uppercase">Instalar Aplicativo</h4>
                      </div>
                      <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                        Para habilitar a instalação desktop, o sistema deve ser aberto fora desta pré-visualização.
                        <br/><br/>
                        1. Clique em <span className="text-slate-900">"Abrir em nova aba"</span> no topo do editor.
                        <br/>
                        2. Na aba aberta, procure o ícone <span className="text-slate-900">"+"</span> ou <span className="text-slate-900">"Instalar"</span> à direita na barra de endereços.
                        <br/><br/>
                        <span className="text-emerald-600">Vantagens:</span> Funcionamento offline e melhor integração com sensores biométricos.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {hasPermission('can_access_admin') && (
              <button 
                onClick={() => setView('admin')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                style={{ backgroundColor: settings?.primaryColor || '#000000' }}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
            )}
            
            <div className="w-[1px] h-8 bg-slate-100 hidden md:block"></div>

            <button 
              onClick={handleLogout}
              className="group flex flex-col items-center gap-0.5"
            >
              <div className="p-2 text-slate-300 group-hover:text-red-500 group-hover:bg-red-50 rounded-xl transition-all">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-[8px] font-black text-slate-300 uppercase group-hover:text-red-500">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-8 py-20">
        <AnimatePresence mode="wait">
          {view === 'form' ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-7xl mx-auto"
            >
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-slate-900">Criar Cartão de Identidade</h2>
                <p className="text-slate-500 mt-2">Preencha os detalhes abaixo para gerar um cartão profissional.</p>
              </div>
              <IDForm onSave={handleSave} settings={settings} />
              {loading && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                  <div className="flex flex-col items-center gap-4">
                    <div 
                      className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: settings?.primaryColor || '#059669', borderTopColor: 'transparent' }}
                    ></div>
                    <p className="font-bold text-slate-900">Gerando Cartão...</p>
                  </div>
                </div>
              )}
            </motion.div>
          ) : view === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-12">
                <h2 className="text-3xl font-black text-slate-900">Registos Emitidos</h2>
                <p className="text-slate-500 mt-2">Gerencie e exporte cartões de identidade gerados anteriormente.</p>
              </div>
              <IDList cards={cards} onDelete={handleDelete} />
            </motion.div>
          ) : (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-7xl mx-auto"
            >
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-slate-900">Configuração de Modelos</h2>
                <p className="text-slate-500 mt-2">Personalize as imagens de fundo do seu cartão de identidade.</p>
              </div>
              <TemplateSettings onSave={() => {}} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-slate-200 py-12 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            {settings?.logo && settings.logo.trim() !== '' ? (
              <img src={settings.logo} className="w-5 h-5 object-contain" alt="Logo" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{settings?.systemName || 'Embaixada'} &copy; 2026</span>
          </div>
          <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
            {settings?.menuLinks && settings.menuLinks.length > 0 ? (
              settings.menuLinks.map((link, idx) => (
                <a key={idx} href={link.url} className="hover:text-slate-600 transition-colors" target="_blank" rel="noreferrer">{link.label}</a>
              ))
            ) : (
              <>
                <a href={settings?.privacyUrl || "#"} className="hover:text-slate-600 transition-colors" target="_blank" rel="noreferrer">Privacidade</a>
                <a href={settings?.termsUrl || "#"} className="hover:text-slate-600 transition-colors" target="_blank" rel="noreferrer">Termos</a>
                <a href={settings?.supportUrl || "#"} className="hover:text-slate-600 transition-colors" target="_blank" rel="noreferrer">Suporte</a>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
