import React, { useRef, useState, useEffect } from 'react';
import { IDCardData, LayoutSettings, ElementPosition } from '../types';
import { cn } from '../lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, Printer, Move } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface IDCardProps {
  data: IDCardData;
  className?: string;
  showActions?: boolean;
  isDesignMode?: boolean;
  onLayoutChange?: (layout: LayoutSettings) => void;
}

const defaultLayout: LayoutSettings = {
  front: {
    fullName: { top: 240, left: 80 },
    fatherName: { top: 275, left: 80 },
    motherName: { top: 310, left: 80 },
    birthDateAndPlace: { top: 345, left: 80 },
    civilStatus: { top: 405, left: 80 },
    profession: { top: 440, left: 80 },
    address: { top: 475, left: 80 },
    idNumber: { top: 180, left: 780 },
    photo: { top: 300, left: 750 },
    signature: { top: 495, left: 682 },
  },
  back: {
    entryDateChina: { top: 120, left: 80 },
    documentPresented: { top: 180, left: 80 },
    issueDate: { top: 240, left: 80 },
    expiryDate: { top: 280, left: 80 },
    fingerprint: { top: 60, left: 800 },
    footerText: { top: 520, left: 50 },
  }
};

export const IDCard: React.FC<IDCardProps> = ({ 
  data, 
  className, 
  showActions = true, 
  isDesignMode = false,
  onLayoutChange 
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<{ front: string; back: string; layout: LayoutSettings }>({ 
    front: '', 
    back: '',
    layout: defaultLayout
  });

  useEffect(() => {
    // Listen to templates and layout in Firebase
    const unsubFront = onSnapshot(doc(db, 'templates', 'front'), (s) => {
      if (s.exists()) setTemplates(prev => ({ ...prev, front: s.data().imageData }));
    }, (e) => console.error("Firestore error (front):", e));
    
    const unsubBack = onSnapshot(doc(db, 'templates', 'back'), (s) => {
      if (s.exists()) setTemplates(prev => ({ ...prev, back: s.data().imageData }));
    }, (e) => console.error("Firestore error (back):", e));
    
    const unsubLayout = onSnapshot(doc(db, 'layout', 'current'), (s) => {
      if (s.exists()) {
        const layoutData = s.data() as LayoutSettings;
        setTemplates(prev => ({ ...prev, layout: layoutData }));
        
        // Handle custom fonts injection
        if (layoutData.customFonts && layoutData.customFonts.length > 0) {
          const styleId = 'custom-id-fonts';
          let styleEl = document.getElementById(styleId) as HTMLStyleElement;
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
          }
          
          let fontFaceCSS = '';
          layoutData.customFonts.forEach(font => {
            fontFaceCSS += `
              @font-face {
                font-family: "${font.name}";
                src: url("${font.data}");
              }
            `;
          });
          styleEl.textContent = fontFaceCSS;
        }

        // Handle Google Fonts injection
        if (layoutData.fontFamily && !layoutData.customFonts?.some(f => f.name === layoutData.fontFamily)) {
          const googleFonts = [
            'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 
            'Playfair Display', 'Merriweather', 'PT Serif', 
            'Space Grotesk', 'JetBrains Mono', 'Poppins', 'Outfit'
          ];
          
          if (googleFonts.includes(layoutData.fontFamily)) {
            const linkId = 'google-id-fonts';
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
    }, (e) => console.error("Firestore error (layout):", e));

    return () => {
      unsubFront();
      unsubBack();
      unsubLayout();
    };
  }, []);

  const handleDragEnd = (side: 'front' | 'back', key: string, info: any) => {
    if (!isDesignMode || !onLayoutChange) return;
    
    const newLayout = { ...templates.layout } as LayoutSettings;
    const currentPos = newLayout[side][key] || { top: 0, left: 0 };
    
    newLayout[side][key] = {
      ...currentPos,
      top: currentPos.top + info.offset.y,
      left: currentPos.left + info.offset.x
    };
    
    setTemplates(prev => ({ ...prev, layout: newLayout }));
    onLayoutChange(newLayout);
  };

  const handleDownloadPNG = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { 
        scale: 2, 
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false
      });
      const link = document.createElement('a');
      link.download = `ID_${data.idNumber || 'cartao'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (error) {
      console.error("Erro ao gerar PNG:", error);
      alert("Erro ao gerar imagem. Tente novamente.");
    }
  };

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { 
        scale: 2, 
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`ID_${data.idNumber || 'cartao'}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const layout = templates.layout || defaultLayout;

  const DraggableElement = ({ side, id, children, className: elClassName }: { side: 'front' | 'back', id: string, children: React.ReactNode, className?: string }) => {
    const pos = layout[side][id] || { top: 0, left: 0 };
    return (
      <motion.div
        drag={isDesignMode}
        dragMomentum={false}
        onDragEnd={(_, info) => handleDragEnd(side, id, info)}
        style={{ 
          position: 'absolute', 
          top: pos.top, 
          left: pos.left,
          cursor: isDesignMode ? 'move' : 'default',
          zIndex: isDesignMode ? 50 : 10
        }}
        className={cn(
          isDesignMode && "ring-2 ring-emerald-500 ring-offset-2 bg-emerald-50/50 rounded px-1",
          elClassName
        )}
      >
        {isDesignMode && (
          <div className="absolute -top-6 left-0 text-white text-[10px] px-1 rounded flex items-center gap-1 whitespace-nowrap" style={{ backgroundColor: 'var(--primary)' }}>
            <Move className="w-2 h-2" /> {id}
          </div>
        )}
        {children}
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div 
        ref={cardRef}
        className={cn(
          "flex flex-col gap-8 p-8 bg-transparent rounded-3xl",
          className
        )}
        id="printable-card"
      >
        {/* FRONT SIDE */}
        <div 
          className="relative w-[1000px] h-[600px] bg-white rounded-xl shadow-2xl overflow-hidden text-slate-900 border border-slate-300"
          style={{ fontFamily: layout.fontFamily || 'serif' }}
        >
          {templates.front && templates.front.trim() !== '' && (
            <img 
              src={templates.front} 
              className="absolute inset-0 w-full h-full object-cover opacity-100" 
              alt="Front Template" 
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          )}
          
          <div className="absolute inset-0">
             <DraggableElement side="front" id="idNumber" className="text-xl font-bold text-slate-800">
               {data.idNumber}
             </DraggableElement>

             <DraggableElement side="front" id="fullName" className="text-[17px] font-bold leading-tight uppercase">
                {data.fullName}
             </DraggableElement>

             <DraggableElement side="front" id="fatherName" className="text-[17px] font-bold leading-tight uppercase">
                {data.fatherName}
             </DraggableElement>

             <DraggableElement side="front" id="motherName" className="text-[17px] font-bold leading-tight uppercase">
                {data.motherName}
             </DraggableElement>

             <DraggableElement side="front" id="birthDateAndPlace" className="text-[17px] font-bold leading-tight uppercase">
                {data.birthDateAndPlace}
             </DraggableElement>

             <DraggableElement side="front" id="civilStatus" className="text-[17px] font-bold leading-tight uppercase">
                {data.civilStatus}
             </DraggableElement>

             <DraggableElement side="front" id="profession" className="text-[17px] font-bold leading-tight uppercase">
                {data.profession}
             </DraggableElement>

             <DraggableElement side="front" id="address" className="text-[17px] font-bold leading-tight items-start uppercase">
                <span className="text-[13px] leading-tight mt-1 max-w-[500px] block">{data.address}</span>
             </DraggableElement>

             <DraggableElement side="front" id="photo" className="flex flex-col items-center gap-2">
                <div className="w-36 h-48 overflow-hidden">
                  {data.photo && data.photo.trim() !== '' && <img src={data.photo} className="w-full h-full object-cover" alt="Foto" referrerPolicy="no-referrer" crossOrigin="anonymous" />}
                </div>
             </DraggableElement>

             <DraggableElement side="front" id="signature" className="flex flex-col items-center">
                <div className="w-[300px] flex flex-col items-center pt-8">
                  <div className="h-24 w-full flex items-center justify-center relative">
                    {data.signature && data.signature.length > 30 ? (
                      <img 
                        src={data.signature} 
                        className="max-h-full max-w-full object-contain mix-blend-multiply transition-all scale-110" 
                        alt="Assinatura Principal" 
                        referrerPolicy="no-referrer" 
                        crossOrigin="anonymous" 
                      />
                    ) : (
                      isDesignMode && <div className="text-[10px] text-slate-300 uppercase font-black border-2 border-dashed border-slate-200 p-4">Área de Assinatura</div>
                    )}
                  </div>
                </div>
             </DraggableElement>
          </div>
        </div>

        {/* BACK SIDE */}
        <div 
          className="relative w-[1000px] h-[600px] bg-white rounded-xl shadow-2xl overflow-hidden text-slate-900 border border-slate-300"
          style={{ fontFamily: layout.fontFamily || 'serif' }}
        >
          {templates.back && templates.back.trim() !== '' && (
            <img 
              src={templates.back} 
              className="absolute inset-0 w-full h-full object-cover opacity-100" 
              alt="Back Template" 
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          )}
          
          <div className="absolute inset-0">
             <DraggableElement side="back" id="entryDateChina" className="text-[17px] font-bold">
                {data.entryDateChina}
             </DraggableElement>

             <DraggableElement side="back" id="documentPresented" className="text-[17px] font-bold uppercase">
                {data.documentPresented}
             </DraggableElement>

             <DraggableElement side="back" id="issueDate" className="text-[17px] font-bold">
                {data.issueDate}
             </DraggableElement>

             <DraggableElement side="back" id="expiryDate" className="text-[17px] font-bold">
                {data.expiryDate}
             </DraggableElement>

             <DraggableElement side="back" id="fingerprint" className="flex flex-col items-center gap-2">
                <div className="w-28 h-36 overflow-hidden">
                  {data.fingerprint && data.fingerprint.trim() !== '' && <img src={data.fingerprint} className="w-full h-full object-contain" alt="Impressão Digital" referrerPolicy="no-referrer" crossOrigin="anonymous" />}
                </div>
             </DraggableElement>
          </div>
        </div>
      </div>

      {showActions && !isDesignMode && (
        <div className="flex flex-wrap justify-center gap-4 no-print">
          <button 
            onClick={handleDownloadPNG}
            className="flex items-center gap-2 px-8 py-3.5 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4" /> Baixar PNG
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-8 py-3.5 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4" /> Baixar PDF
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-10 py-3.5 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-2xl hover:brightness-110 active:scale-95"
            style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 30px -10px var(--primary)' }}
          >
            <Printer className="w-4 h-4" /> Imprimir Cartão
          </button>
        </div>
      )}
    </div>
  );
};
