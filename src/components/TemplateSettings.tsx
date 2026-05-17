import React, { useState, useEffect } from 'react';
import { Upload, Save, Layout, Move, Type, Plus, X } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { IDCard } from './IDCard';
import { IDCardData, LayoutSettings } from '../types';

interface TemplateSettingsProps {
  onSave: () => void;
}

const sampleData: IDCardData = {
  fullName: 'NOME COMPLETO DO TITULAR',
  fatherName: 'NOME DO PAI',
  motherName: 'NOME DA MÃE',
  birthDateAndPlace: '01/01/1990 em Luanda, Angola',
  birthDate: '1990-01-01',
  gender: 'M',
  civilStatus: 'SOLTEIRO',
  profession: 'PROFISSÃO / CARGO',
  address: 'ENDEREÇO COMPLETO DO TITULAR EM CHINA OU ANGOLA',
  idNumber: '001 - 26',
  entryDateChina: '18/10/2023',
  documentPresented: 'Passaporte - N2707584',
  issueDate: '2026.01.01',
  expiryDate: '2028.01.19',
  photo: 'https://picsum.photos/seed/user/300/400',
  fingerprint: 'https://picsum.photos/seed/finger/200/300',
  signature: 'https://picsum.photos/seed/sig/300/100',
  created_at: new Date().toISOString()
};

export const TemplateSettings: React.FC<TemplateSettingsProps> = ({ onSave }) => {
  const [frontImage, setFrontImage] = useState<string>('');
  const [backImage, setBackImage] = useState<string>('');
  const [layout, setLayout] = useState<LayoutSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'design' | 'fonts'>('images');

  const preloadedFonts = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 
    'Playfair Display', 'Merriweather', 'PT Serif', 
    'Space Grotesk', 'JetBrains Mono', 'Poppins', 'Outfit'
  ];

  useEffect(() => {
    const unsubFront = onSnapshot(doc(db, 'templates', 'front'), (snapshot) => {
      if (snapshot.exists()) setFrontImage(snapshot.data().imageData);
    }, (error) => console.error("Firestore error (front template):", error));
    
    const unsubBack = onSnapshot(doc(db, 'templates', 'back'), (snapshot) => {
      if (snapshot.exists()) setBackImage(snapshot.data().imageData);
    }, (error) => console.error("Firestore error (back template):", error));
    
    const unsubLayout = onSnapshot(doc(db, 'layout', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const layoutData = snapshot.data() as LayoutSettings;
        setLayout(layoutData);

        // Handle custom fonts injection for preview
        if (layoutData.customFonts && layoutData.customFonts.length > 0) {
          const styleId = 'custom-preview-fonts';
          let styleEl = document.getElementById(styleId) as HTMLStyleElement;
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
          }
          let fontFaceCSS = '';
          layoutData.customFonts.forEach(font => {
            fontFaceCSS += `@font-face { font-family: "${font.name}"; src: url("${font.data}"); }\n`;
          });
          styleEl.textContent = fontFaceCSS;
        }

        // Handle Google Fonts injection for preview
        if (layoutData.fontFamily) {
          const googleFonts = [
            'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 
            'Playfair Display', 'Merriweather', 'PT Serif', 
            'Space Grotesk', 'JetBrains Mono', 'Poppins', 'Outfit'
          ];
          if (googleFonts.includes(layoutData.fontFamily)) {
            const linkId = 'google-preview-fonts';
            let linkEl = document.getElementById(linkId) as HTMLLinkElement;
            const fontUrl = `https://fonts.googleapis.com/css2?family=${layoutData.fontFamily.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
            if (!linkEl) {
              linkEl = document.createElement('link');
              linkEl.id = linkId;
              linkEl.rel = 'stylesheet';
              document.head.appendChild(linkEl);
            }
            linkEl.href = fontUrl;
          }
        }
      }
    }, (error) => console.error("Firestore error (layout):", error));
    
    return () => {
      unsubFront();
      unsubBack();
      unsubLayout();
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (side === 'front') setFrontImage(base64String);
        else setBackImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all([
        setDoc(doc(db, 'templates', 'front'), { imageData: frontImage }),
        setDoc(doc(db, 'templates', 'back'), { imageData: backImage })
      ]);
      alert('Modelos guardados com sucesso no Firebase!');
      onSave();
    } catch (error) {
      alert('Erro ao guardar modelos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLayout = async () => {
    if (!layout) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'layout', 'current'), layout);
      alert('Layout guardado com sucesso no Firebase!');
    } catch (error) {
      alert('Erro ao guardar layout');
    } finally {
      setLoading(false);
    }
  };

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && layout) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const fontName = file.name.split('.')[0];
        
        const newCustomFonts = [...(layout.customFonts || []), { name: fontName, data: base64String }];
        const newLayout = { ...layout, customFonts: newCustomFonts };
        setLayout(newLayout);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFont = (index: number) => {
    if (!layout) return;
    const newCustomFonts = [...(layout.customFonts || [])];
    newCustomFonts.splice(index, 1);
    setLayout({ ...layout, customFonts: newCustomFonts });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
          <button 
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'images' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Upload className="w-4 h-4" /> Imagens de Fundo
          </button>
          <button 
            onClick={() => setActiveTab('design')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'design' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Move className="w-4 h-4" /> Personalizar Posições
          </button>
          <button 
            onClick={() => setActiveTab('fonts')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'fonts' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Type className="w-4 h-4" /> Fontes e Tipografia
          </button>
        </div>
      </div>

      {activeTab === 'images' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Front Template */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Frente do Cartão</h3>
                <Layout className="text-slate-300 w-6 h-6" />
              </div>
              
              <div className="aspect-[1.58/1] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                {frontImage && frontImage.trim() !== '' ? (
                  <img src={frontImage} className="w-full h-full object-cover" alt="Frente" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-xs font-bold uppercase tracking-widest">Carregar Imagem</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'front')}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-400 font-medium">Recomendado: 1011 x 638 pixels (CR-80)</p>
            </div>

            {/* Back Template */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Verso do Cartão</h3>
                <Layout className="text-slate-300 w-6 h-6" />
              </div>
              
              <div className="aspect-[1.58/1] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                {backImage && backImage.trim() !== '' ? (
                  <img src={backImage} className="w-full h-full object-cover" alt="Verso" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-xs font-bold uppercase tracking-widest">Carregar Imagem</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'back')}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-400 font-medium">Recomendado: 1011 x 638 pixels (CR-80)</p>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Modelos no Firebase
                </>
              )}
            </button>
          </div>
        </div>
      ) : activeTab === 'design' ? (
        <div className="space-y-8">
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Move className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-emerald-900">Modo de Design Ativado</h4>
              <p className="text-emerald-700 text-sm">Arraste os elementos no cartão abaixo para ajustar as suas posições. As alterações serão aplicadas a todos os cartões.</p>
            </div>
          </div>

          <div className="overflow-x-auto pb-8">
            <div className="min-w-[1100px] flex justify-center">
              <IDCard 
                data={sampleData} 
                isDesignMode={true} 
                onLayoutChange={(newLayout) => setLayout(newLayout)}
              />
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button 
              onClick={handleSaveLayout}
              disabled={loading}
              className="flex items-center gap-2 px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Layout no Firebase
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
            <div className="space-y-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Type className="w-5 h-5 text-slate-400" /> Fonte do Cartão
              </h3>
              <p className="text-sm text-slate-500">Escolha a fonte principal que será aplicada a todos os textos do cartão.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Selecionar Fonte</label>
                  <select 
                    className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                    value={layout?.fontFamily || 'serif'}
                    onChange={(e) => layout && setLayout({ ...layout, fontFamily: e.target.value })}
                  >
                    <optgroup label="Padrão">
                      <option value="serif">Serif (Clássico)</option>
                      <option value="sans-serif">Sans-Serif (Moderno)</option>
                      <option value="monospace">Monospace (Técnico)</option>
                    </optgroup>
                    <optgroup label="Google Fonts Integradas">
                      {preloadedFonts.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </optgroup>
                    {layout?.customFonts && layout.customFonts.length > 0 && (
                      <optgroup label="Fontes Importadas">
                        {layout.customFonts.map(font => (
                          <option key={font.name} value={font.name}>{font.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                  <span className="text-2xl font-bold" style={{ fontFamily: layout?.fontFamily || 'serif' }}>
                    Exemplo de Texto
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Importar Fontes Personalizadas</h3>
                  <p className="text-sm text-slate-500">Carregue arquivos .ttf, .otf ou .woff para usar no cartão.</p>
                </div>
                <div className="relative">
                  <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-all">
                    <Plus className="w-4 h-4" /> Carregar Arquivo
                  </button>
                  <input 
                    type="file" 
                    accept=".ttf,.otf,.woff,.woff2"
                    onChange={handleFontUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {layout?.customFonts && layout.customFonts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {layout.customFonts.map((font, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <Type className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{font.name}</p>
                          <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Personalizada</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFont(idx)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <Type className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma fonte personalizada importada</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button 
              onClick={handleSaveLayout}
              disabled={loading}
              className="flex items-center gap-2 px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Fontes no Firebase
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
