import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  CreditCard, 
  Settings, 
  Plus, 
  Trash2, 
  Search, 
  Download, 
  Palette, 
  ImageIcon, 
  Type,
  LayoutDashboard,
  LogOut,
  UserPlus,
  Filter,
  Calendar,
  Save,
  PieChart as PieIcon,
  UserCheck,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Globe,
  Monitor,
  RefreshCw,
  Zap,
  History,
  FileText,
  UploadCloud,
  Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { User, IDCardData, SystemSettings, MenuLink } from '../types';
import { cn } from '../lib/utils';
import { db, auth } from '../firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  orderBy,
  where,
  Timestamp
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  getAuth, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { IDCard } from './IDCard';
import { format, parseISO } from 'date-fns';

interface AdminDashboardProps {
  onLogout: () => void;
  onGoToIssuance: () => void;
  installPrompt: any;
  onInstall: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onGoToIssuance, installPrompt, onInstall }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'settings' | 'updates'>('stats');
  const [users, setUsers] = useState<User[]>([]);
  const [cards, setCards] = useState<IDCardData[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<IDCardData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  
  const monthsList = ['Todos', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    gender: '',
    address: '',
    birthDate: '',
    startDate: '',
    endDate: ''
  });

  // User Form
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'operator' as const, 
    photo: '',
    permissions: ['can_create_cards', 'can_view_records'] as string[]
  });

  useEffect(() => {
    // Listen to users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id as any } as User)));
    }, (error) => {
      console.error("Firestore error (users):", error);
    });

    // Listen to cards
    const unsubCards = onSnapshot(query(collection(db, 'id_cards'), orderBy('created_at', 'desc')), (snapshot) => {
      setCards(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id as any } as IDCardData)));
    }, (error) => {
      console.error("Firestore error (cards):", error);
    });

    // Listen to settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SystemSettings);
      }
    }, (error) => {
      console.error("Firestore error (settings):", error);
    });

    return () => {
      unsubUsers();
      unsubCards();
      unsubSettings();
    };
  }, []);

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchesSearch = 
        !filters.name ||
        card.fullName.toLowerCase().includes(filters.name.toLowerCase()) ||
        card.idNumber.toLowerCase().includes(filters.name.toLowerCase());
      
      const matchesGender = !filters.gender || card.gender === filters.gender;
      
      const matchesAddress = !filters.address || card.address.toLowerCase().includes(filters.address.toLowerCase());
      
      const matchesBirthDate = !filters.birthDate || card.birthDate === filters.birthDate;
      
      const createdAt = card.created_at ? card.created_at.split('T')[0] : '';
      const matchesStartDate = !filters.startDate || createdAt >= filters.startDate;
      const matchesEndDate = !filters.endDate || createdAt <= filters.endDate;

      const cardMonth = card.created_at ? format(parseISO(card.created_at), 'MMMM', { locale: undefined }) : '';
      const ptMonthMap: {[key: string]: string} = {
        'January': 'Janeiro', 'February': 'Fevereiro', 'March': 'Março', 'April': 'Abril', 
        'May': 'Maio', 'June': 'Junho', 'July': 'Julho', 'August': 'Agosto', 
        'September': 'Setembro', 'October': 'Outubro', 'November': 'Novembro', 'December': 'Dezembro'
      };
      const translatedMonth = ptMonthMap[cardMonth] || cardMonth;
      const matchesMonth = selectedMonth === 'Todos' || translatedMonth === selectedMonth;

      return matchesSearch && matchesGender && matchesAddress && matchesBirthDate && matchesStartDate && matchesEndDate && matchesMonth;
    });
  }, [cards, filters, selectedMonth]);

  const cardStats = useMemo(() => {
    const total = filteredCards.length;
    const male = filteredCards.filter(c => c.gender === 'M').length;
    const female = filteredCards.filter(c => c.gender === 'F').length;
    
    // Cards by type (Nova Emissão vs Renovação)
    // Handle existing data where registrationType might be undefined
    const newIssuance = filteredCards.filter(c => c.registrationType === 'Nova Emissão' || !c.registrationType).length;
    const renewal = filteredCards.filter(c => c.registrationType === 'Renovação').length;
    const duplication = filteredCards.filter(c => c.registrationType === 'Duplicado').length;
    const supplemental = filteredCards.filter(c => c.registrationType === 'Suplementar').length;

    // Monthly data for the chart
    const ptMonthMap: {[key: string]: string} = {
      'January': 'Janeiro', 'February': 'Fevereiro', 'March': 'Março', 'April': 'Abril', 
      'May': 'Maio', 'June': 'Junho', 'July': 'Julho', 'August': 'Agosto', 
      'September': 'Setembro', 'October': 'Outubro', 'November': 'Novembro', 'December': 'Dezembro'
    };

    // Calculate comparative data for the bar chart based on selected filters
    const categories = ['Nova Emissão', 'Renovação', 'Duplicado', 'Suplementar'];
    
    const chartData = categories.map(cat => {
      // Current filtered value for this category
      const current = filteredCards.filter(c => {
        const type = c.registrationType || 'Nova Emissão';
        return type === cat;
      }).length;

      // Comparative value (if specific month is selected, compare with previous one)
      let comparative = 0;
      if (selectedMonth !== 'Todos') {
        const prevMonthIdx = monthsList.indexOf(selectedMonth) - 1;
        const prevMonth = prevMonthIdx > 0 ? monthsList[prevMonthIdx] : null;
        
        if (prevMonth) {
          comparative = cards.filter(c => {
            const type = c.registrationType || 'Nova Emissão';
            if (type !== cat) return false;
            if (!c.created_at) return false;
            const cMonth = format(parseISO(c.created_at), 'MMMM');
            return ptMonthMap[cMonth] === prevMonth || cMonth === prevMonth;
          }).length;
        }
      } else {
        // If "Todos", comparative is all time average? No, let's just show current if "Todos"
        comparative = 0;
      }

      return {
        name: cat,
        atual: current,
        anterior: comparative,
        selectedLabel: selectedMonth === 'Todos' ? 'Total' : selectedMonth,
        prevLabel: 'Anterior'
      };
    });

    return { total, male, female, newIssuance, renewal, duplication, supplemental, chartData };
  }, [filteredCards, cards, selectedMonth]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let secondaryApp;
    
    // Trim inputs to prevent accidental spaces causing login failures
    const trimmedEmail = newUser.email.trim();
    const trimmedPassword = newUser.password.trim();
    const trimmedName = newUser.name.trim();

    try {
      // 1. Create user in Firebase Auth using a secondary app instance
      // This allows creating a user without logging out the current admin
      secondaryApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        trimmedEmail, 
        trimmedPassword
      );
      
      const newUid = userCredential.user.uid;

      // 2. Create the user document in Firestore
      await setDoc(doc(db, 'users', newUid), {
        name: trimmedName,
        email: trimmedEmail,
        role: newUser.role,
        permissions: newUser.permissions,
        photo: newUser.photo,
        created_at: new Date().toISOString()
      });

      // 3. Clean up
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      setShowUserModal(false);
      setNewUser({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'operator' as const, 
        photo: '',
        permissions: ['can_create_cards', 'can_view_records']
      });
      alert("Usuário criado com sucesso em ambos os serviços (Autenticação e Base de Dados).");
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      let errorMsg = "Erro ao criar usuário.";
      
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = "Este e-mail já está em uso.";
      } else if (error.code === 'auth/weak-password') {
        errorMsg = "A senha é muito fraca (mínimo 6 caracteres).";
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = "E-mail inválido.";
      }
      
      alert(errorMsg);
    } finally {
      setLoading(false);
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (e) {}
      }
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Tem certeza que deseja eliminar este usuário?")) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      alert("Erro ao eliminar usuário");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await setDoc(doc(db, 'settings', 'main'), settings);
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configurações");
    }
  };

  const handleExportStats = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Relatório Geral de Cartões Emitidos", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    
    const tableData = filteredCards.map(c => [
      c.fullName,
      c.idNumber,
      c.gender === 'M' ? 'Masculino' : c.gender === 'F' ? 'Feminino' : 'Outro',
      c.created_at ? format(parseISO(c.created_at), 'dd/MM/yyyy') : '-',
      c.created_by_name || 'N/A'
    ]);

    autoTable(doc, {
      head: [['Nome do Titular', 'Número ID', 'Sexo', 'Data de Emissão', 'Atendente']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save("relatorio_geral_cartoes.pdf");
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm("Tem certeza que deseja eliminar este cartão?")) return;
    try {
      await deleteDoc(doc(db, 'id_cards', id));
    } catch (error) {
      alert("Erro ao eliminar cartão");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-80 bg-slate-900 text-white flex flex-col p-8 fixed h-full z-50">
        <div className="flex items-center gap-3 mb-12 px-2">
          {settings?.logo && settings.logo.trim() !== '' ? (
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 overflow-hidden shadow-lg border border-white/10">
              <img src={settings.logo} className="w-full h-full object-contain" alt="Logo" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/5">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
          )}
          <span className="font-black text-xl tracking-tight leading-none">
            {settings?.systemName || 'Embaixada ID'}
          </span>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('stats')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === 'stats' ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <CreditCard className="w-5 h-5" /> Gestão de Cartões
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === 'users' ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Users className="w-5 h-5" /> Gestão de Usuários
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === 'settings' ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Settings className="w-5 h-5" /> Personalização
          </button>
          <button 
            onClick={() => setActiveTab('updates')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === 'updates' ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <RefreshCw className="w-5 h-5" /> Atualização
          </button>
        </nav>

        <div className="pt-6 border-t border-white/10 space-y-2">
          <button 
            onClick={onGoToIssuance}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-emerald-400 hover:bg-emerald-400/10 transition-all font-sans"
          >
            <Plus className="w-5 h-5" /> Emissão de Cartões
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-5 h-5" /> Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-80 p-16">
        {activeTab === 'stats' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Painel de Gestão</h2>
                <p className="text-slate-500 font-medium">Acompanhe estatísticas e gerencie todos os cartões emitidos.</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={onInstall}
                  className={cn(
                    "hidden md:flex items-center justify-center w-12 h-12 rounded-xl transition-all hover:scale-110 active:scale-95",
                    installPrompt 
                      ? "text-white shadow-xl" 
                      : "text-slate-400 bg-slate-50 border border-slate-100 opacity-80"
                  )}
                  style={installPrompt ? { backgroundColor: '#4f46e5', boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)' } : {}}
                  title="Versão Desktop"
                >
                  <div className="relative">
                    <Monitor className="w-5 h-5" />
                    <Download className={cn("w-3 h-3 absolute -bottom-1 -right-1 rounded-full p-0.5", installPrompt ? "bg-white text-slate-900" : "bg-slate-200 text-slate-500")} />
                  </div>
                </button>

                <button 
                  onClick={handleExportStats}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
                >
                  <Download className="w-5 h-5" /> Exportar Relatório Geral
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{cardStats.total}</div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Total</div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{cardStats.male}</div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Masculino</div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center mb-3">
                  <PieIcon className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{cardStats.female}</div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Feminino</div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{cardStats.newIssuance}</div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Novas</div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{cardStats.renewal}</div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Renovações</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gauge Charts (Sondas) */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-between text-center">
                <div className="w-full flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Distribuição por Sexo</h3>
                  <Activity className="w-4 h-4 text-slate-300" />
                </div>
                <div className="w-full h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Masculino', value: cardStats.male },
                          { name: 'Feminino', value: cardStats.female }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        startAngle={180}
                        endAngle={0}
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="#ec4899" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                    <span className="text-2xl font-black text-slate-900">{cardStats.total}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                  </div>
                </div>
                <div className="w-full grid grid-cols-2 gap-4 mt-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl">
                    <p className="text-[9px] font-black text-indigo-400 uppercase">Homens</p>
                    <p className="text-lg font-black text-indigo-600">{Math.round((cardStats.male / (cardStats.total || 1)) * 100)}%</p>
                  </div>
                  <div className="p-3 bg-pink-50 rounded-2xl">
                    <p className="text-[9px] font-black text-pink-400 uppercase">Mulheres</p>
                    <p className="text-lg font-black text-pink-600">{Math.round((cardStats.female / (cardStats.total || 1)) * 100)}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-between text-center">
                <div className="w-full flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tipo de Registro</h3>
                  <PieIcon className="w-4 h-4 text-slate-300" />
                </div>
                <div className="w-full h-48 relative">
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Novas', value: cardStats.newIssuance },
                          { name: 'Renovações', value: cardStats.renewal },
                          { name: 'Duplicados', value: cardStats.duplication }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                        startAngle={180}
                        endAngle={-90}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#6366f1" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                    <span className="text-2xl font-black text-slate-900">
                      {cardStats.total > 0 ? Math.round((cardStats.newIssuance / cardStats.total) * 100) : 0}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Eficiência New</span>
                  </div>
                </div>
                <div className="w-full p-4 bg-slate-50 rounded-2xl mt-4 border border-slate-100 flex justify-between gap-2">
                   <div className="text-left">
                     <p className="text-[9px] font-black text-emerald-600 uppercase">Novas</p>
                     <p className="text-sm font-black text-slate-900">{cardStats.newIssuance}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[9px] font-black text-amber-600 uppercase">Renovações</p>
                     <p className="text-sm font-black text-slate-900">{cardStats.renewal}</p>
                   </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-between text-center">
                <div className="w-full flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Status do Sistema</h3>
                  <Zap className="w-4 h-4 text-slate-300" />
                </div>
                <div className="w-full h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Eficiência', value: 94 },
                          { name: 'Otimização', value: 6 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                        startAngle={180}
                        endAngle={0}
                      >
                        <Cell fill="#0f172a" />
                        <Cell fill="#f1f5f9" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                    <span className="text-2xl font-black text-slate-900">94/100</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Performance</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest mt-4 self-center animate-pulse">
                  Sistema Nominal
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">Eficiência Por Categoria</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {selectedMonth === 'Todos' ? 'Análise Geral de Atividade' : `Comparativo: ${selectedMonth} vs Anterior`}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-slate-900 transition-all cursor-pointer"
                  >
                    {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#0f172a] rounded-sm" />
                      <span className="text-[10px] font-black text-slate-500 uppercase">{selectedMonth === 'Todos' ? 'Total' : selectedMonth}</span>
                    </div>
                    {selectedMonth !== 'Todos' && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[#c2410c] rounded-sm" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">Mês Ant.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
 
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={cardStats.chartData}
                    margin={{ top: 30, right: 30, left: 20, bottom: 20 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(val) => val.toLocaleString('pt-PT')}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar 
                      dataKey="atual" 
                      fill="#0f172a" 
                      name={selectedMonth === 'Todos' ? 'Geral' : selectedMonth}
                      radius={[6, 6, 0, 0]}
                      label={{ 
                        position: 'top', 
                        fill: '#0f172a', 
                        fontSize: 10, 
                        fontWeight: 900,
                        formatter: (val: any) => val > 0 ? val.toLocaleString('pt-PT') : ''
                      }}
                    />
                    {selectedMonth !== 'Todos' && (
                      <Bar 
                        dataKey="anterior" 
                        fill="#c2410c" 
                        name="Anterior"
                        radius={[6, 6, 0, 0]}
                        label={{ 
                          position: 'top', 
                          fill: '#c2410c', 
                          fontSize: 10, 
                          fontWeight: 900,
                          formatter: (val: any) => val > 0 ? val.toLocaleString('pt-PT') : ''
                        }}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {/* Data Table */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-50 flex flex-col gap-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    <h3 className="text-xl font-black text-slate-900 mr-auto">Lista Geral</h3>
                    <div className="relative flex-1 md:flex-none">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Filtrar por nome..."
                        value={filters.name}
                        onChange={(e) => setFilters(prev => ({...prev, name: e.target.value}))}
                        className="w-full md:w-auto pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        showFilters ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                      title="Filtros Avançados"
                    >
                      <Filter className="w-4 h-4" />
                    </button>
                  </div>

                  {showFilters && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sexo</label>
                        <select 
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none"
                          value={filters.gender}
                          onChange={e => setFilters(prev => ({ ...prev, gender: e.target.value }))}
                        >
                          <option value="">Todos</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Endereço</label>
                        <input 
                          type="text" 
                          placeholder="Filtro por morada..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none"
                          value={filters.address}
                          onChange={e => setFilters(prev => ({ ...prev, address: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Nasc.</label>
                        <input 
                          type="date" 
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none"
                          value={filters.birthDate}
                          onChange={e => setFilters(prev => ({ ...prev, birthDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Início Criação</label>
                        <input 
                          type="date" 
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none"
                          value={filters.startDate}
                          onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fim Criação</label>
                        <input 
                          type="date" 
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none"
                          value={filters.endDate}
                          onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                      </div>
                      <div className="col-span-full flex justify-end">
                        <button 
                          onClick={() => setFilters({ name: '', gender: '', address: '', birthDate: '', startDate: '', endDate: '' })}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase"
                        >
                          Limpar Filtros
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-auto max-h-[400px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-6 py-4">Titular</th>
                        <th className="px-6 py-4">Atendente</th>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCards.map((card) => (
                        <tr key={card.id as any} className="hover:bg-slate-50/50 transition-all group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 text-sm truncate max-w-[150px]">{card.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono tracking-tighter">{card.idNumber}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-bold">{card.created_by_name || 'N/A'}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs">{card.created_at ? format(parseISO(card.created_at), 'dd/MM/yy') : '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1">
                              <button 
                                onClick={() => setSelectedCard(card)}
                                className="p-2 text-slate-400 hover:text-emerald-600 transition-all"
                                title="Ver Cartão"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => card.id && handleDeleteCard(card.id as any)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Gestão de Usuários</h2>
                <p className="text-slate-500">Gerencie quem tem acesso ao sistema.</p>
              </div>
              <button 
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
              >
                <UserPlus className="w-5 h-5" /> Novo Usuário
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((user) => (
                <div key={user.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 group">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                    {user.photo && user.photo.trim() !== '' ? (
                      <img src={user.photo} className="w-full h-full object-cover" alt={user.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Users className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{user.name}</h4>
                    <p className="text-slate-500 text-sm truncate">{user.email}</p>
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mt-1",
                      user.role === 'admin' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {user.role}
                    </span>
                  </div>
                  <button 
                    onClick={() => user.id && handleDeleteUser(user.id as any)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900">Personalização</h2>
              <p className="text-slate-500">Ajuste a identidade visual do sistema.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="max-w-7xl bg-white p-16 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Type className="w-4 h-4" /> Nome do Sistema
                    </label>
                    <input 
                      type="text" 
                      value={settings?.systemName || ''}
                      onChange={(e) => setSettings(prev => prev ? {...prev, systemName: e.target.value} : { id: 'main', systemName: e.target.value, primaryColor: '#10b981', logo: '' })}
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Palette className="w-4 h-4" /> Cor Primária (Texto/Icones)
                      </label>
                      <div className="flex gap-4">
                        <input 
                          type="color" 
                          value={settings?.primaryColor || '#0f172a'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, primaryColor: e.target.value} : { id: 'main', systemName: '', primaryColor: e.target.value, logo: '' })}
                          className="w-12 h-12 rounded-xl cursor-pointer border-none"
                        />
                        <input 
                          type="text" 
                          value={settings?.primaryColor || '#0f172a'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, primaryColor: e.target.value} : prev)}
                          className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Palette className="w-4 h-4 text-slate-300" /> Cor Secundária (Fundo Card)
                      </label>
                      <div className="flex gap-4">
                        <input 
                          type="color" 
                          value={settings?.secondaryColor || '#ffffff'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, secondaryColor: e.target.value} : prev)}
                          className="w-12 h-12 rounded-xl cursor-pointer border-none"
                        />
                        <input 
                          type="text" 
                          value={settings?.secondaryColor || '#ffffff'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, secondaryColor: e.target.value} : prev)}
                          className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Palette className="w-4 h-4 text-yellow-500" /> Cor de Destaque (Accent)
                      </label>
                      <div className="flex gap-4">
                        <input 
                          type="color" 
                          value={settings?.accentColor || '#facc15'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, accentColor: e.target.value} : prev)}
                          className="w-12 h-12 rounded-xl cursor-pointer border-none"
                        />
                        <input 
                          type="text" 
                          value={settings?.accentColor || '#facc15'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, accentColor: e.target.value} : prev)}
                          className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Palette className="w-4 h-4 text-slate-100" /> Cor de Fundo Geral
                      </label>
                      <div className="flex gap-4">
                        <input 
                          type="color" 
                          value={settings?.backgroundColor || '#f8fafc'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, backgroundColor: e.target.value} : prev)}
                          className="w-12 h-12 rounded-xl cursor-pointer border-none"
                        />
                        <input 
                          type="text" 
                          value={settings?.backgroundColor || '#f8fafc'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, backgroundColor: e.target.value} : prev)}
                          className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Fundo do Login
                    </label>
                    <div className="flex gap-4 items-start">
                      <div className="w-32 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group relative">
                        {settings?.loginBackground && settings.loginBackground.trim() !== '' ? (
                          <img src={settings.loginBackground} className="w-full h-full object-cover" alt="Login BG Preview" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <Plus className="w-6 h-6 text-white" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64 = reader.result as string;
                                  setSettings(prev => prev ? {...prev, loginBackground: base64} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', loginBackground: base64 });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex-1 space-y-2">
                        <input 
                          type="text" 
                          value={settings?.loginBackground || ''}
                          onChange={(e) => setSettings(prev => prev ? {...prev, loginBackground: e.target.value} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', loginBackground: e.target.value })}
                          placeholder="Cole a URL da imagem ou use o botão de upload..."
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-medium text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Recomendado: 1920x1080px (PNG/JPG).</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-500" /> Textos da Página de Login
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rótulo Superior</label>
                        <input 
                          type="text" 
                          value={settings?.loginWelcomeLabel || ''}
                          onChange={(e) => setSettings(prev => prev ? {...prev, loginWelcomeLabel: e.target.value} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', loginWelcomeLabel: e.target.value })}
                          placeholder="Ex: Portal Consular"
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Título Grande</label>
                        <input 
                          type="text" 
                          value={settings?.loginTitle || ''}
                          onChange={(e) => setSettings(prev => prev ? {...prev, loginTitle: e.target.value} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', loginTitle: e.target.value })}
                          placeholder="Ex: Bem-vindo ao Sistema de Emissão"
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Descrição / Subtítulo</label>
                      <textarea 
                        value={settings?.loginSubtitle || ''}
                        onChange={(e) => setSettings(prev => prev ? {...prev, loginSubtitle: e.target.value} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', loginSubtitle: e.target.value })}
                        placeholder="Ex: Plataforma oficial para gestão e personalização..."
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-xs font-bold h-20 resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Texto do Rodapé</label>
                      <input 
                        type="text" 
                        value={settings?.loginFooterText || ''}
                        onChange={(e) => setSettings(prev => prev ? {...prev, loginFooterText: e.target.value} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', loginFooterText: e.target.value })}
                        placeholder="Ex: © 2026 Embaixada • Segurança Máxima"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-xs font-bold"
                      />
                    </div>
                  </div>

                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 space-y-4">
                  <h4 className="text-xs font-black text-indigo-900 flex items-center gap-2 uppercase tracking-tighter">
                    <Sparkles className="w-4 h-4 text-indigo-500" /> Integrações de Inteligência Artificial
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        Remove.bg API Key
                      </label>
                      <a 
                        href="https://www.remove.bg/api#remove-background" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"
                      >
                        Obter Chave <CreditCard className="w-3 h-3" />
                      </a>
                    </div>
                    <input 
                      type="password" 
                      value={settings?.removeBgApiKey || ''}
                      onChange={(e) => setSettings(prev => prev ? {...prev, removeBgApiKey: e.target.value} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', removeBgApiKey: e.target.value })}
                      placeholder="XNYqtioqWachgAw6KgLjBLYn"
                      className="w-full px-5 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm shadow-sm"
                    />
                    <p className="text-[10px] text-indigo-400">Ao adicionar sua chave, o sistema habilitará a remoção de fundo com qualidade industrial (IA Cloud).</p>
                  </div>
                </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Logótipo do Sistema
                    </label>
                    <div className="flex gap-4 items-start">
                      <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 group relative shadow-inner">
                        {settings?.logo && settings.logo.trim() !== '' ? (
                          <img src={settings.logo} className="w-full h-full object-contain p-2" alt="Logo Preview" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <Plus className="w-6 h-6 text-white" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64 = reader.result as string;
                                  setSettings(prev => prev ? {...prev, logo: base64} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: base64 });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex-1 space-y-2">
                        <textarea 
                          value={settings?.logo || ''}
                          onChange={(e) => setSettings(prev => prev ? {...prev, logo: e.target.value} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: e.target.value })}
                          placeholder="Ficheiro carregado ou URL..."
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-medium text-xs h-20 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                      <Type className="w-4 h-4 text-emerald-500" /> Tipografia do Sistema
                    </h4>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fonte para Títulos</label>
                        <select 
                          value={settings?.headingFont || '"Inter", sans-serif'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, headingFont: e.target.value} : prev)}
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm font-bold"
                        >
                          <option value='"Inter", sans-serif'>Inter (Padrão)</option>
                          <option value='"Montserrat", sans-serif'>Montserrat</option>
                          <option value='"Poppins", sans-serif'>Poppins</option>
                          <option value='"Playfair Display", serif'>Playfair Display</option>
                          <option value='"Orbitron", sans-serif'>Orbitron (Tech)</option>
                          <option value='"Roboto", sans-serif'>Roboto</option>
                          <option value='"Open Sans", sans-serif'>Open Sans</option>
                        </select>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fonte para Corpo / Frases</label>
                        <select 
                          value={settings?.bodyFont || '"Inter", sans-serif'}
                          onChange={(e) => setSettings(prev => prev ? {...prev, bodyFont: e.target.value} : prev)}
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm font-bold"
                        >
                          <option value='"Inter", sans-serif'>Inter (Padrão)</option>
                          <option value='"Roboto", sans-serif'>Roboto</option>
                          <option value='"Open Sans", sans-serif'>Open Sans</option>
                          <option value='"Poppins", sans-serif'>Poppins</option>
                          <option value='"Montserrat", sans-serif'>Montserrat</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Manual (CSS font-family)</label>
                      <input 
                        type="text" 
                        value={settings?.headingFont || ''}
                        onChange={(e) => setSettings(prev => prev ? {...prev, headingFont: e.target.value} : prev)}
                        placeholder="Ex: 'My Custom Font', sans-serif"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Carregar Fonte Personalizada (.ttf, .woff, .woff2)</label>
                      <div className="flex gap-4 items-center">
                        <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl cursor-pointer hover:bg-emerald-100 transition-all border border-emerald-100 text-[10px] font-black uppercase">
                          <Plus className="w-4 h-4" /> Selecionar Ficheiro
                          <input 
                            type="file" 
                            accept=".ttf,.woff,.woff2" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64 = reader.result as string;
                                  const name = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
                                  setSettings(prev => prev ? {
                                    ...prev, 
                                    customFontName: name, 
                                    customFontData: base64,
                                    headingFont: `"${name}", sans-serif`,
                                    bodyFont: `"${name}", sans-serif`
                                  } : prev);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {settings?.customFontName && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400">Fonte ativa:</span>
                            <span className="text-[10px] font-black text-slate-900">{settings.customFontName}</span>
                            <button 
                              type="button"
                              onClick={() => setSettings(prev => prev ? {...prev, customFontName: undefined, customFontData: undefined} : prev)}
                              className="text-red-400 hover:text-red-600 ml-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400">Ao carregar, a fonte será aplicada automaticamente a todo o sistema após salvar.</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" /> Links Informativos do Rodapé
                    </h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">URL Privacidade</label>
                        <input 
                          type="text" 
                          value={settings?.privacyUrl || ''}
                          onChange={(e) => setSettings(prev => prev ? {...prev, privacyUrl: e.target.value} : prev)}
                          placeholder="https://sua-url.com/privacidade"
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">URL Termos</label>
                        <input 
                          type="text" 
                          value={settings?.termsUrl || ''}
                          onChange={(e) => setSettings(prev => prev ? {...prev, termsUrl: e.target.value} : prev)}
                          placeholder="https://sua-url.com/termos"
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">URL Suporte</label>
                        <input 
                          type="text" 
                          value={settings?.supportUrl || ''}
                          onChange={(e) => setSettings(prev => prev ? {...prev, supportUrl: e.target.value} : prev)}
                          placeholder="https://sua-url.com/suporte"
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                      <span>Links do Menu</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const links = [...(settings?.menuLinks || [])];
                          links.push({ label: '', url: '' });
                          setSettings(prev => prev ? {...prev, menuLinks: links} : { id: 'main', systemName: '', primaryColor: '#10b981', logo: '', menuLinks: links });
                        }}
                        className="text-emerald-600 hover:text-emerald-700 font-black"
                      >
                        + Adicionar
                      </button>
                    </label>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {(settings?.menuLinks || []).map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Rótulo"
                            value={link.label}
                            onChange={(e) => {
                              const links = [...(settings?.menuLinks || [])];
                              links[idx].label = e.target.value;
                              setSettings(prev => prev ? {...prev, menuLinks: links} : prev);
                            }}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm"
                          />
                          <input 
                            type="text" 
                            placeholder="URL"
                            value={link.url}
                            onChange={(e) => {
                              const links = [...(settings?.menuLinks || [])];
                              links[idx].url = e.target.value;
                              setSettings(prev => prev ? {...prev, menuLinks: links} : prev);
                            }}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const links = (settings?.menuLinks || []).filter((_, i) => i !== idx);
                              setSettings(prev => prev ? {...prev, menuLinks: links} : prev);
                            }}
                            className="p-2 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> Salvar Alterações
              </button>
            </form>
          </div>
        )}
        {activeTab === 'updates' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Gestão de Atualizações</h2>
                <p className="text-slate-500 font-medium">Mantenha o sistema seguro e atualizado com as últimas melhorias.</p>
              </div>
              <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Versão Atual: v{settings?.version || '1.2.0'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Upload Section */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">Instalar Novo Pacote</h3>
                      <p className="text-sm text-slate-400 font-bold">Carregue o ficheiro .ZIP de atualização.</p>
                    </div>
                  </div>

                  <div className="border-4 border-dashed border-slate-100 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center group hover:border-slate-200 transition-all cursor-pointer bg-slate-50/50">
                    <div className="w-20 h-20 bg-white rounded-[1.5rem] shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-10 h-10 text-slate-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-900 font-black">Arraste o ficheiro ou clique para selecionar</p>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Apenas ficheiros .ZIP autorizados</p>
                    </div>
                    <input type="file" accept=".zip" className="hidden" />
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <ShieldCheck className="w-6 h-6 text-amber-600 flex-shrink-0" />
                    <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                      Atenção: A instalação de pacotes não oficiais pode comprometer a segurança dos dados. 
                      Certifique-se de que o pacote foi emitido pelo suporte técnico autorizado.
                    </p>
                  </div>

                  <button 
                    type="button"
                    onClick={() => alert("Simulação: O pacote ZIP está a ser processado e verificado...")}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 group"
                  >
                    <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                    Iniciar Processamento da Atualização
                  </button>
                </div>

                {/* System Report */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">Relatório do Sistema</h3>
                      <p className="text-sm text-slate-400 font-bold">Estado atual e modificações recentes.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Indicador</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">Módulos de Segurança</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-black rounded uppercase">Ativo</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">Motor de Impressão PDF</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-black rounded uppercase">v2.4 (Otimizado)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">Sincronização Cloud</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-black rounded uppercase">Síncrono</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">Proteção CSRF/XSS</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-black rounded uppercase">Máxima</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">Melhorias na Versão Atual:</p>
                      <ul className="space-y-2">
                        <li className="flex gap-3 text-xs text-slate-600 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          Implementação de carregamento de fontes personalizadas para branding.
                        </li>
                        <li className="flex gap-3 text-xs text-slate-600 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          Aumento da largura dos formulários para melhor ergonomia de preenchimento.
                        </li>
                        <li className="flex gap-3 text-xs text-slate-600 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          Otimização do sistema de PWA para instalação desktop via barra de endereços.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* History Section */}
              <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl space-y-8 h-fit">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 text-white rounded-2xl flex items-center justify-center">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Histórico</h3>
                    <p className="text-sm text-slate-400 font-bold">Registo de Versões</p>
                  </div>
                </div>

                <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                  {(settings?.updatesHistory || [
                    { version: '1.2.0', date: '2026-05-17', changes: 'Suporte a fontes e UI expandida', type: 'minor' },
                    { version: '1.1.5', date: '2026-05-10', changes: 'Correções no módulo de assinaturas', type: 'patch' },
                    { version: '1.1.0', date: '2026-05-01', changes: 'Integração com Remove.bg para fotos', type: 'minor' },
                    { version: '1.0.0', date: '2026-04-15', changes: 'Lançamento Inicial do Sistema', type: 'major' }
                  ]).map((update, idx) => (
                    <div key={idx} className="relative pl-10 group">
                      <div className={cn(
                        "absolute left-2.5 -translate-x-1/2 top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 z-10 transition-all group-hover:scale-125",
                        update.type === 'major' ? "bg-indigo-500" : update.type === 'minor' ? "bg-emerald-500" : "bg-amber-500"
                      )} />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-black text-sm">v{update.version}</span>
                          <span className="text-[10px] text-slate-500 font-bold tracking-tighter">{update.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium leading-tight">{update.changes}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/5 mt-4">
                  <p className="text-[9px] text-slate-500 font-black uppercase text-center tracking-widest">Sistema de Identidade Consular • v1.2.0</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Preview Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl p-8 relative my-8">
            <button 
              onClick={() => setSelectedCard(null)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-all z-10"
            >
              <Plus className="w-6 h-6 rotate-45 text-slate-400" />
            </button>
            <div className="flex flex-col items-center gap-8">
              <h3 className="text-2xl font-black text-slate-900">Visualizar Cartão</h3>
              <IDCard data={selectedCard} />
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900">Novo Usuário</h3>
              <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Trash2 className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                <input 
                  required
                  type="email" 
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
                <input 
                  required
                  type="password" 
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Cargo / Função</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold"
                >
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Permissões de Acesso</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'can_create_cards', label: 'Novo Cartão' },
                    { id: 'can_view_records', label: 'Registos' },
                    { id: 'can_manage_templates', label: 'Modelos' },
                    { id: 'can_access_admin', label: 'Painel ADM' }
                  ].map(perm => (
                    <label key={perm.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <input 
                        type="checkbox"
                        checked={newUser.permissions.includes(perm.id)}
                        onChange={(e) => {
                          const perms = e.target.checked 
                            ? [...newUser.permissions, perm.id]
                            : newUser.permissions.filter(p => p !== perm.id);
                          setNewUser({ ...newUser, permissions: perms });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-xs font-bold text-slate-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Foto de Perfil (URL)</label>
                <input 
                  type="text" 
                  value={newUser.photo}
                  onChange={(e) => setNewUser({...newUser, photo: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold"
                  placeholder="https://..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-4 border border-slate-200 hover:bg-slate-50 rounded-2xl font-bold transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Criar Usuário"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
