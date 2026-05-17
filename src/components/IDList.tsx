import React, { useState, useMemo } from 'react';
import { Trash2, Download, Search, Filter, Calendar, FileText, X, CreditCard, User as UserIcon, Printer, FileDown, PieChart } from 'lucide-react';
import { IDCardData } from '../types';
import { IDCard } from './IDCard';
import { differenceInYears, parseISO, format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface IDListProps {
  cards: IDCardData[];
  onDelete: (id: any) => void;
}

export const IDList: React.FC<IDListProps> = ({ cards, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState<IDCardData | null>(null);
  const [previewZoom, setPreviewZoom] = useState(0.5);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    gender: '',
    address: '',
    birthDate: '',
    startDate: '',
    endDate: ''
  });

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchesSearch = 
        card.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.idNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGender = !filters.gender || card.gender === filters.gender;
      
      const matchesAddress = !filters.address || (card.address && card.address.toLowerCase().includes(filters.address.toLowerCase()));
      
      const matchesBirthDate = !filters.birthDate || card.birthDate === filters.birthDate;
      
      const createdAt = card.created_at ? card.created_at.split('T')[0] : '';
      const matchesStartDate = !filters.startDate || createdAt >= filters.startDate;
      const matchesEndDate = !filters.endDate || createdAt <= filters.endDate;

      return matchesSearch && matchesGender && matchesAddress && matchesBirthDate && matchesStartDate && matchesEndDate;
    });
  }, [cards, searchTerm, filters]);

  const stats = useMemo(() => {
    const total = filteredCards.length;
    const male = filteredCards.filter(c => c.gender === 'M').length;
    const female = filteredCards.filter(c => c.gender === 'F').length;
    const others = total - male - female;
    
    return { total, male, female, others };
  }, [filteredCards]);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Relatório de Gestão de Cartões', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.text(`Total de registos: ${filteredCards.length}`, 14, 35);

    const tableData = filteredCards.map(card => [
      card.fullName,
      card.idNumber,
      card.gender === 'M' ? 'Masculino' : card.gender === 'F' ? 'Feminino' : 'Outro',
      card.birthDate ? format(parseISO(card.birthDate), 'dd/MM/yyyy') : '-',
      card.created_at ? format(parseISO(card.created_at), 'dd/MM/yyyy') : '-',
      card.created_by_name || 'N/A'
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Nome', 'ID', 'Sexo', 'Nascimento', 'Criação', 'Atendente']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] } // Using dark blue/black as default
    });

    doc.save(`relatorio-cartoes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Geral</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masculino</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.male}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-pink-50 flex items-center justify-center text-pink-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feminino</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.female}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" style={{ backgroundColor: 'var(--accent)', opacity: 0.1 }}></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'white', color: 'var(--accent)', border: '1px solid #f1f5f9' }}>
                <Printer className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impressos</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou número de ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-medium"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${showFilters ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              style={showFilters ? { backgroundColor: 'var(--primary)' } : {}}
            >
              <Filter className="w-4 h-4" /> Filtros
            </button>
            <button 
              onClick={generatePDF}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl hover:brightness-110"
              style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 30px -10px var(--primary)' }}
            >
              <FileDown className="w-4 h-4" /> Exportar
            </button>
            <button 
              onClick={handlePrint}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-900 border-2 border-slate-100 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sexo</label>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none"
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
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none"
                value={filters.address}
                onChange={e => setFilters(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Pesquisar por endereço..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nascimento</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none"
                value={filters.birthDate}
                onChange={e => setFilters(prev => ({ ...prev, birthDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Início Criação</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none"
                value={filters.startDate}
                onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fim Criação</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none"
                value={filters.endDate}
                onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3 lg:col-span-6 flex justify-end">
              <button 
                onClick={() => setFilters({ gender: '', address: '', birthDate: '', startDate: '', endDate: '' })}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => (
          <div 
            key={card.id as any} 
            className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden"
          >
            <div className="aspect-[1.58/1] bg-slate-100 relative overflow-hidden">
              {card.photo && card.photo.trim() !== '' ? (
                <img src={card.photo} className="w-full h-full object-cover" alt={card.fullName} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <CreditCard className="w-12 h-12" />
                </div>
              )}
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                <button 
                  onClick={() => setSelectedCard(card)}
                  className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 transition-all shadow-lg"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => onDelete(card.id)}
                  className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-all shadow-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-black text-slate-900 truncate flex-1">{card.fullName}</h3>
                <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded uppercase tracking-wider text-slate-500">ID: {card.idNumber}</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">{card.profession}</p>
              
              <div className="my-4 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-wider">
                  {card.gender === 'M' ? 'Masculino' : card.gender === 'F' ? 'Feminino' : 'Outro'}
                </span>
                {card.birthDate && (
                  <span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-wider">
                    {differenceInYears(new Date(), parseISO(card.birthDate))} anos
                  </span>
                )}
              </div>

              <div className="pt-4 border-t border-slate-50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atendente:</span>
                  <span className="text-[10px] font-bold text-slate-600 truncate max-w-[150px]">{card.created_by_name || 'Desconhecido'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emitido em:</span>
                  <span className="text-[10px] font-bold text-slate-600">{card.created_at ? format(parseISO(card.created_at), 'dd/MM/yyyy') : '-'}</span>
                </div>
                <button 
                  onClick={() => setSelectedCard(card)}
                  className="w-full mt-4 py-3 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  Ver Detalhes do Cartão
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCards.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="text-slate-300 w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Nenhum registo encontrado</h3>
          <p className="text-slate-500 mt-1">Tente ajustar os seus termos de pesquisa ou filtros.</p>
        </div>
      )}

      {selectedCard && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex flex-col p-4 md:p-8">
          <div className="bg-white w-full max-w-7xl mx-auto rounded-[40px] shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-white z-10 shrink-0">
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-black text-slate-900 leading-tight">Visualização do Cartão</h2>
                <p className="text-slate-500 font-medium text-sm">Ajuste o zoom para conferir detalhes ou imprimir.</p>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-4 bg-slate-100 px-6 py-2.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase text-slate-400">Zoom: {Math.round(previewZoom * 100)}%</span>
                  <input 
                    type="range" min="0.2" max="1.5" step="0.05"
                    value={previewZoom}
                    onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
                    className="w-32 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                </div>

                <button 
                  onClick={() => window.print()}
                  className="px-6 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl transition-all flex items-center gap-2 font-bold text-sm border border-emerald-100"
                >
                  <Printer className="w-5 h-5" /> Imprimir
                </button>

                <button 
                  onClick={() => setSelectedCard(null)}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400"
                  title="Fechar"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-auto bg-slate-200/50 relative p-4 md:p-12">
              {/* Checkerboard Pattern Container */}
              <div 
                className="min-h-full flex justify-center items-start py-12 rounded-[2rem] shadow-inner"
                style={{
                  backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px), radial-gradient(#cbd5e1 1px, #f1f5f9 1px)`,
                  backgroundSize: "24px 24px",
                  backgroundPosition: "0 0, 12px 12px"
                }}
              >
                <div 
                  className="print:shadow-none origin-top transition-transform duration-200 ease-out transform-gpu"
                  style={{ transform: `scale(${previewZoom})` }}
                >
                  <IDCard data={selectedCard} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex justify-center shrink-0">
              <button 
                onClick={() => setSelectedCard(null)}
                className="px-16 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all active:scale-95"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
