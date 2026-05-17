import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IDCardData, SystemSettings } from '../types';
import SignatureCanvas from 'react-signature-canvas';
import Webcam from 'react-webcam';
import { Camera, Fingerprint, PenTool, Save, Trash2, Upload, RefreshCw, Check, X, Sparkles, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { removeBackground } from '@imgly/background-removal';
import { DeviceEvent, FingerprintReader, SampleFormat } from '@digitalpersona/devices';

interface IDFormProps {
  onSave: (data: IDCardData) => void;
  initialData?: Partial<IDCardData>;
  settings?: SystemSettings | null;
}

export const IDForm: React.FC<IDFormProps> = ({ onSave, initialData = {}, settings }) => {
  const [formData, setFormData] = useState<IDCardData>({
    fullName: '',
    fatherName: '',
    motherName: '',
    birthDateAndPlace: '',
    birthDate: '',
    gender: 'M',
    civilStatus: 'SOLTEIRO',
    profession: '',
    address: '',
    idNumber: '',
    entryDateChina: '',
    documentPresented: 'Passaporte - ',
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    photo: '',
    fingerprint: '',
    signature: '',
    registrationType: 'Nova Emissão',
    created_at: new Date().toISOString(),
    ...initialData
  });

  const sigCanvas = useRef<SignatureCanvas>(null);
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reader = useRef<FingerprintReader | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoMode, setPhotoMode] = useState<'upload' | 'camera'>('upload');
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBiometricActive, setIsBiometricActive] = useState(false);
  const [isReaderConnected, setIsReaderConnected] = useState(false);
  const [isAiLoaded, setIsAiLoaded] = useState(false);
  const [isCloudProcessing, setIsCloudProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const l = pixels.data.length;
    let i, bound = {
      top: null as number | null,
      left: null as number | null,
      right: null as number | null,
      bottom: null as number | null
    }, x, y;

    for (i = 0; i < l; i += 4) {
      if (pixels.data[i + 3] !== 0) {
        x = (i / 4) % canvas.width;
        y = Math.floor((i / 4) / canvas.width);

        if (bound.top === null) bound.top = y;
        if (bound.left === null) bound.left = x;
        else if (x < bound.left) bound.left = x;
        if (bound.right === null) bound.right = x;
        else if (x > bound.right) bound.right = x;
        if (bound.bottom === null) bound.bottom = y;
        else if (y > bound.bottom) bound.bottom = y;
      }
    }

    if (bound.top === null) return canvas;

    const trimHeight = bound.bottom! - bound.top! + 1;
    const trimWidth = bound.right! - bound.left! + 1;
    const trimmed = ctx.getImageData(bound.left!, bound.top!, trimWidth, trimHeight);

    const copy = document.createElement('canvas');
    copy.width = trimWidth;
    copy.height = trimHeight;
    const copyCtx = copy.getContext('2d')!;
    copyCtx.putImageData(trimmed, 0, 0);

    return copy;
  };

  const compressImage = async (base64Str: string, maxWidth: number, maxHeight: number, quality: number = 0.7, forceType?: string): Promise<string> => {
    if (!base64Str || !base64Str.startsWith('data:')) return base64Str;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Str);
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG for items without alpha, PNG for transparent ones
        // If we forced transparency earlier (photo editing), keep PNG
        const hasAlpha = base64Str.includes('image/png');
        const type = forceType || (hasAlpha ? 'image/png' : 'image/jpeg');
        
        // If it's JPEG, we can use the quality parameter effectively
        resolve(canvas.toDataURL(type, quality));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const [editParams, setEditParams] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    tolerance: 30,
    transparentColor: null as string | null
  });

  // Initialize AI and DigitalPersona
  useEffect(() => {
    // 1. AI is handled lazily by @imgly, but we can set loaded to true
    setIsAiLoaded(true);

    // 2. Initialise DigitalPersona Reader
    const initReader = async () => {
      try {
        console.log("Inicializando DigitalPersona...");
        
        // Ensure we are in a browser
        if (typeof window === 'undefined') return;

        // Ensure WebSdk is loaded (from index.html script)
        let attempts = 0;
        while (!(window as any).WebSdk && attempts < 10) {
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }

        const sdk = (window as any).WebSdk;
        if (!sdk) {
          console.error("WebSdk.js não foi carregado corretamente.");
          return;
        }

        // Patch for 'this.webChannel.isConnected is not a function' error
        // This can happen if the library expects a specific WebChannel implementation
        if (sdk.WebChannel && !sdk.WebChannel.prototype.isConnected) {
          sdk.WebChannel.prototype.isConnected = function() {
            return !!this.socket && this.socket.readyState === 1;
          };
        }

        // The @digitalpersona/devices package wrapper
        try {
          reader.current = new FingerprintReader();
          console.log("FingerprintReader instanciado com sucesso via NPM.");
        } catch (e) {
          console.warn("Falha ao instanciar via NPM, tentando via global window.Fingerprint...", e);
          const GlobalReader = (window as any).Fingerprint?.Reader || (window as any).FingerprintReader;
          if (GlobalReader) {
            reader.current = new GlobalReader();
          } else {
            throw new Error("HID Fingerprint SDK não encontrado no sistema.");
          }
        }

        if (!reader.current) return;

        // Check for devices - we wrap this to avoid breaking if still connecting
        try {
          const deviceList = await reader.current.enumerateDevices();
          if (deviceList && deviceList.length > 0) {
            console.log("Sensores detectados:", deviceList);
            setIsReaderConnected(true);
          } else {
            console.warn("Nenhum sensor DigitalPersona detectado na inicialização.");
            setIsReaderConnected(false);
          }
        } catch (deviceErr) {
          console.warn("Erro ao enumerar dispositivos (pode estar ainda a ligar):", deviceErr);
        }

        reader.current.on("DeviceConnected", (e: DeviceEvent) => {
          console.log("Sensor DigitalPersona Conectado:", e);
          setIsReaderConnected(true);
        });
        reader.current.on("DeviceDisconnected", (e: DeviceEvent) => {
          console.log("Sensor DigitalPersona Desconectado:", e);
          setIsReaderConnected(false);
        });
        reader.current.on("SamplesAcquired", async (e: any) => {
          console.log("Amostra Biométrica Recebida:", e);
          if (e.samples && e.samples.length > 0) {
            // Clean the base64 string if it contains whitespace or is raw
            let rawSample = e.samples[0];
            if (typeof rawSample !== 'string') {
               rawSample = JSON.stringify(rawSample);
            }
            const imageData = rawSample.startsWith('data:') ? rawSample : `data:image/png;base64,${rawSample.replace(/\s/g, '')}`;
            const compressed = await compressImage(imageData, 300, 400, 0.4, 'image/jpeg');
            setFormData(prev => ({ ...prev, fingerprint: compressed }));
            setIsBiometricActive(false);
            reader.current?.stopAcquisition().catch(err => console.error("Erro ao parar aquisição:", err));
          }
        });
        
        reader.current.on("QualityReported", (e: any) => {
          console.log("Qualidade da Leitura:", e);
        });

        reader.current.on("ErrorOccurred", (e: any) => {
          console.error("Erro no Sensor DigitalPersona:", e);
          setIsBiometricActive(false);
        });

      } catch (err) {
        console.error("Erro crítico ao inicializar DigitalPersona:", err);
      }
    };

    initReader();

    return () => {
      reader.current?.off();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'fingerprint' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        let result = reader.result as string;
        
        // Compress based on field type - using lower resolutions for Firestore
        if (field === 'photo') {
          result = await compressImage(result, 400, 533, 0.7, 'image/png');
        } else if (field === 'signature') {
          result = await compressImage(result, 300, 150, 0.6, 'image/png');
        } else if (field === 'fingerprint') {
          result = await compressImage(result, 300, 400, 0.5, 'image/jpeg');
        }

        setFormData(prev => ({ ...prev, [field]: result }));
        if (field === 'photo') {
          setIsEditingPhoto(true);
          setEditParams(prev => ({ ...prev, transparentColor: null }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const applyFilters = () => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = formData.photo;
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.filter = `brightness(${editParams.brightness}%) contrast(${editParams.contrast}%) saturate(${editParams.saturation}%)`;
        ctx.drawImage(img, 0, 0);

        if (editParams.transparentColor) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Basic Chroma Key (Non-AI)
          const targetR = parseInt(editParams.transparentColor.slice(1, 3), 16);
          const targetG = parseInt(editParams.transparentColor.slice(3, 5), 16);
          const targetB = parseInt(editParams.transparentColor.slice(5, 7), 16);
          const tolerance = editParams.tolerance;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const distance = Math.sqrt(
              Math.pow(r - targetR, 2) + 
              Math.pow(g - targetG, 2) + 
              Math.pow(b - targetB, 2)
            );

            if (distance < tolerance) {
              data[i + 3] = 0; // Alpha to 0 (Transparent)
            }
          }
          ctx.putImageData(imageData, 0, 0);
        }

        const filteredResult = canvas.toDataURL('image/png');
        const compressedResult = await compressImage(filteredResult, 400, 533, 0.7, 'image/png');
        
        setFormData(prev => ({ ...prev, photo: compressedResult }));
        setIsEditingPhoto(false);
      }
    };
  };

  const pickColorFromImage = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(img, 0, 0);
    
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;
    
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
    setEditParams(prev => ({ ...prev, transparentColor: hex }));
  };

  const processWithLocalAI = async (sourceOverride?: string) => {
    const imageToProcess = sourceOverride || formData.photo;
    if (!imageToProcess) return;

    try {
      setIsProcessing(true);
      setProcessingProgress(0);
      console.log("Iniciando remoção de fundo local com @imgly/background-removal (isnet)...");
      
      // Configuration to try and avoid fetch issues
      const blob = await removeBackground(imageToProcess, {
        model: 'isnet', 
        output: {
          format: 'image/png',
          quality: 1.0
        },
        progress: (status, progress) => {
          setProcessingProgress(Math.round(progress * 100));
          if (status === 'fetch-model') console.log(`Baixando Modelos IA: ${Math.round(progress * 100)}%`);
          if (status === 'compute') console.log(`Processando Imagem: ${Math.round(progress * 100)}%`);
        }
      });
      
      console.log("Remoção local concluída. Convertendo blob...");
      const reader = new FileReader();
      reader.onloadend = async () => {
         const img = new Image();
         img.src = reader.result as string;
         img.onload = async () => {
           const canvas = document.createElement('canvas');
           canvas.width = img.width;
           canvas.height = img.height;
           const ctx = canvas.getContext('2d')!;
           const rawResult = canvas.toDataURL('image/png');
           const compressedResult = await compressImage(rawResult, 400, 533, 0.7, 'image/png');
           setFormData(prev => ({ ...prev, photo: compressedResult }));
           setIsProcessing(false);
           console.log("Processamento local concluído com transparência e compressão.");
         };
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Erro Crítico na remoção de fundo local:", error);
      setIsProcessing(false);
      
      const isFetchError = error instanceof Error && (error.message.includes('fetch') || error.message.includes('NetworkError'));
      
      if (isFetchError) {
        alert("Erro de Rede: O seu navegador não conseguiu descarregar os modelos de IA (WASM). Isso pode ser devido a restrições de rede ou firewall.\n\nPor favor, utilize a opção 'IA Cloud' (Remove.bg) que já está configurada e é mais estável.");
      } else {
        alert("A IA Local não conseguiu processar esta imagem. Por favor, tente a opção 'IA Cloud' ou remova o fundo manualmente no editor.");
      }
    }
  };

  const processWithCloudAI = async () => {
    // Priority: 1. Settings 2. Hardcoded fallback provided by user
    const apiKey = settings?.removeBgApiKey || 'XNYqtioqWachgAw6KgLjBLYn';
    
    if (!apiKey || apiKey === '' || apiKey === 'CHAVE_API_AQUI') {
      alert("Chave de API Remove.bg não configurada. Por favor, adicione-a no painel Administrativo ou contacte o suporte.");
      return;
    }

    try {
      setIsCloudProcessing(true);
      console.log("Iniciando processamento via Cloud (Remove.bg) com chave:", apiKey.slice(0, 4) + '...');
      
      // Convert base64/dataURL to Blob to send as real file - more robust than image_file_b64
      const responseImg = await fetch(formData.photo);
      const blobImg = await responseImg.blob();
      
      const formDataObj = new FormData();
      formDataObj.append('image_file', blobImg, 'photo.png');
      formDataObj.append('size', 'auto');

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formDataObj
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.errors?.[0]?.title || 'Erro desconhecido na API';
        throw new Error(msg);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        const compressed = await compressImage(result, 400, 533, 0.7, 'image/png');
        setFormData(prev => ({ ...prev, photo: compressed }));
        setIsCloudProcessing(false);
        console.log("Remoção Cloud concluída com sucesso e compressão.");
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error("Erro Cloud IA:", err);
      let friendlyMsg = "Falha no processamento Cloud.";
      
      if (err.message?.includes('Insufficient credits')) {
        friendlyMsg = "Saldo de créditos insuficiente na API Remove.bg.";
      } else if (err.message?.includes('API key')) {
        friendlyMsg = "Chave de API inválida.";
      } else {
        friendlyMsg = `Erro: ${err.message}`;
      }
      
      alert(friendlyMsg);
      setIsCloudProcessing(false);
    }
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setFormData(prev => ({ ...prev, signature: '' }));
  };

  const saveSignature = useCallback(async () => {
    if (!sigCanvas.current) return;
    if (sigCanvas.current.isEmpty && sigCanvas.current.isEmpty()) return;
    
    try {
      // Manual trim to avoid external dependency issues
      const rawCanvas = sigCanvas.current.getCanvas();
      const trimmedCanvas = trimCanvas(rawCanvas);
      
      const dataURL = trimmedCanvas.toDataURL('image/png');
      const compressed = await compressImage(dataURL, 300, 150, 0.5, 'image/png');
      setFormData(prev => ({ ...prev, signature: compressed }));
      console.log("Assinatura salva com sucesso (Trim manual).");
    } catch (err) {
      console.error("Erro ao salvar assinatura:", err);
    }
  }, [sigCanvas, compressImage]);

  const capturePhoto = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      const compressed = await compressImage(imageSrc, 400, 533, 0.7, 'image/png');
      setFormData(prev => ({ ...prev, photo: compressed }));
      setIsCameraActive(false);
      setIsEditingPhoto(true);

      if (autoRemoveBg) {
        // Set photo then remove
        setFormData(prev => ({ ...prev, photo: compressed }));
        setIsCameraActive(false);
        setIsEditingPhoto(true);
        
        // Use Cloud AI if available, else fallback to Local
        if (settings?.removeBgApiKey) {
          setTimeout(() => processWithCloudAI(), 600);
        } else {
          setTimeout(() => processWithLocalAI(compressed), 600);
        }
      }
    }
  }, [webcamRef, autoRemoveBg, settings, compressImage, processWithCloudAI, processWithLocalAI]);

  // DigitalPersona Integration
  const captureBiometric = async () => {
    if (!reader.current) {
      alert("Serviço DigitalPersona não detectado ou inicializado. Certifique-se de que o DigitalPersona Web Components está instalado e o serviço está a correr.");
      // Attempt to re-init
      (window as any).location.reload(); 
      return;
    }

    try {
      setIsBiometricActive(true);
      console.log("Iniciando Verificação Biométrica...");
      
      // SampleFormat.PngImage is 5.
      // We wrap it in a try-catch and check if it's already acquiring
      try {
        await reader.current.startAcquisition(5);
        console.log("Aquisição iniciada. Por favor, coloque o dedo no sensor.");
      } catch (acqErr: any) {
        if (acqErr.message?.includes("already acquiring")) {
          console.warn("Já está em processo de captura.");
        } else {
          throw acqErr;
        }
      }
      
      // Auto-stop after 45 seconds if no touch detected
      setTimeout(() => {
        if (isBiometricActive) {
          reader.current?.stopAcquisition().catch(() => {});
          setIsBiometricActive(false);
          console.log("Captura interrompida por tempo limite.");
        }
      }, 45000);

    } catch (err: any) {
      console.error("Falha na captura biométrica:", err);
      setIsBiometricActive(false);
      
      let errorMsg = "Falha ao comunicar com o sensor.";
      if (err.message?.includes("device not found")) errorMsg = "Sensor DigitalPersona não encontrado ou desconectado.";
      if (err.message?.includes("busy")) errorMsg = "O sensor está sendo usado por outra aplicação.";
      
      alert(errorMsg);
      
      // Fallback for demo
      if (confirm("Deseja usar uma amostra de demonstração para continuar?")) {
        setFormData(prev => ({ 
          ...prev, 
          fingerprint: 'https://raw.githubusercontent.com/hidglobal/uareu-web-sdk-samples/master/resources/fingerprint.png' 
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Formulário submetido. Dados:", formData);
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-100 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Basic Info */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100/50">
            <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: 'var(--accent)' }}></div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Informação Pessoal
            </h3>
          </div>
          
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome / 名称</label>
            <input 
              type="text" 
              required
              className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
              value={formData.fullName}
              onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filiação / 之子</label>
            <input 
              type="text" 
              placeholder="Nome do Pai"
              className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
              value={formData.fatherName}
              onChange={e => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E / 和</label>
            <input 
              type="text" 
              placeholder="Nome da Mãe"
              className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
              value={formData.motherName}
              onChange={e => setFormData(prev => ({ ...prev, motherName: e.target.value }))}
            />
          </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de nascimento e local / 出生日期和地点</label>
            <input 
              type="text" 
              placeholder="Ex: 01/01/1990, Luanda"
              className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
              value={formData.birthDateAndPlace}
              onChange={e => setFormData(prev => ({ ...prev, birthDateAndPlace: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 invisible hidden">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Nascimento (Oculto)</label>
              <input 
                type="date" 
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.birthDate}
                onChange={e => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo / 性别</label>
              <select 
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.gender}
                onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
              >
                <option value="M">MASCULINO</option>
                <option value="F">FEMININO</option>
                <option value="Other">OUTRO</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de entrada na CHINA / 进入中国的日期</label>
            <input 
              type="text" 
              placeholder="Ex: 18/10/2023"
              className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
              value={formData.entryDateChina}
              onChange={e => setFormData(prev => ({ ...prev, entryDateChina: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado civil / 婚姻状况</label>
              <select 
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.civilStatus}
                onChange={e => setFormData(prev => ({ ...prev, civilStatus: e.target.value }))}
              >
                <option value="SOLTEIRO">SOLTEIRO</option>
                <option value="CASADO">CASADO</option>
                <option value="DIVORCIADO">DIVORCIADO</option>
                <option value="VIÚVO">VIÚVO</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profissão / 职业</label>
              <input 
                type="text" 
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.profession}
                onChange={e => setFormData(prev => ({ ...prev, profession: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço / 地址</label>
            <textarea 
              className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
              rows={2}
              value={formData.address}
              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Registro / 注册类型</label>
              <select 
                required
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.registrationType}
                onChange={e => setFormData(prev => ({ ...prev, registrationType: e.target.value as any }))}
              >
                <option value="Nova Emissão">NOVA EMISSÃO</option>
                <option value="Renovação">RENOVAÇÃO</option>
                <option value="Duplicado">DUPLICADO</option>
                <option value="Suplementar">SUPLEMENTAR</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Registo (ID)</label>
              <input 
                type="text" 
                required
                placeholder="Ex: 001 - 26"
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.idNumber}
                onChange={e => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento apresentado / 提交的文件</label>
            <input 
              type="text" 
              className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
              value={formData.documentPresented}
              onChange={e => setFormData(prev => ({ ...prev, documentPresented: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Beijing aos / 北京, 年 月</label>
              <input 
                type="text" 
                placeholder="Ex: 2026.01.01 / 2026年1月19"
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.issueDate}
                onChange={e => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Válido até / 本文件有效期至</label>
              <input 
                type="text" 
                placeholder="Ex: 2028/01/19"
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                value={formData.expiryDate}
                onChange={e => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Media Uploads */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
            <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: 'var(--accent)' }}></div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Media e Biometria
            </h3>
          </div>

          {/* Photo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase">Foto Especializada</label>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setAutoRemoveBg(!autoRemoveBg)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all border",
                    autoRemoveBg 
                      ? (settings?.removeBgApiKey 
                          ? "bg-indigo-50 text-indigo-600 border-indigo-200" 
                          : (isAiLoaded ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200 animate-pulse")) 
                      : "bg-slate-50 text-slate-400 border-slate-100"
                  )}
                  title={autoRemoveBg 
                    ? (settings?.removeBgApiKey ? "Fundo será removido via Cloud IA (Rápido)" : "Fundo será removido via Local IA (Lento)") 
                    : "Remoção automática desativada"}
                >
                  <Sparkles className={cn("w-3 h-3", !isAiLoaded && autoRemoveBg && !settings?.removeBgApiKey && "animate-spin")} /> 
                  {autoRemoveBg 
                    ? (settings?.removeBgApiKey ? "Auto" : (isAiLoaded ? "Local" : "Carregando...")) 
                    : "Manual"}
                </button>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    type="button"
                    onClick={() => { setPhotoMode('upload'); setIsCameraActive(false); }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${photoMode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Upload
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setPhotoMode('camera'); setIsCameraActive(true); }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${photoMode === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Câmara
                  </button>
                </div>
              </div>
            </div>

            {/* Hidden processing canvas */}
            <canvas ref={canvasRef} className="hidden" />

            <div className="space-y-4">
              {isEditingPhoto && formData.photo ? (
                <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl my-auto">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-20">
                      <div className="flex flex-col">
                        <h3 className="text-xl font-black text-slate-900">Editor Profissional</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Ajuste de brilho e remoção de fundo</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsEditingPhoto(false)} 
                        className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase"
                      >
                        <X className="w-4 h-4" /> Cancelar
                      </button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto p-4 md:p-8 space-y-8">
                      <div 
                        className="p-4 md:p-8 rounded-2xl flex justify-center relative shadow-inner"
                        style={{
                          backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px), radial-gradient(#cbd5e1 1px, #f1f5f9 1px)`,
                          backgroundSize: "20px 20px",
                          backgroundPosition: "0 0, 10px 10px",
                          backgroundColor: "#f8fafc"
                        }}
                      >
                         <div 
                          className="relative w-48 h-64 md:w-64 md:h-80 rounded-2xl overflow-hidden shadow-2xl"
                        >
                        <img 
                          src={formData.photo} 
                          alt="Edit" 
                          className="w-full h-full object-cover"
                          style={{
                            filter: `brightness(${editParams.brightness}%) contrast(${editParams.contrast}%) saturate(${editParams.saturation}%)`
                          }}
                        />
                        {isProcessing && (
                          <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-4">
                            <div className="relative w-16 h-16 mb-4">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="transparent"
                                  className="text-slate-100"
                                />
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="transparent"
                                  strokeDasharray={175.9}
                                  strokeDashoffset={175.9 * (1 - processingProgress / 100)}
                                  className="text-emerald-500 transition-all duration-300"
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{processingProgress}%</span>
                            </div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Removendo Fundo Local...</p>
                            <p className="text-[10px] text-slate-500 mt-1">Isso pode levar alguns segundos na primeira vez</p>
                          </div>
                        )}
                        {isCloudProcessing && (
                          <div className="absolute inset-0 bg-indigo-50/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 text-indigo-900">
                            <Sparkles className="w-8 h-8 animate-pulse mb-2 text-indigo-500" />
                            <p className="text-xs font-black uppercase tracking-tighter">Processamento Concluído</p>
                            <p className="text-[10px] opacity-70 mt-1">Refinando recorte em alta qualidade</p>
                          </div>
                        )}
                      </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-2">
                                <span>Brilho</span>
                                <span>{editParams.brightness}%</span>
                              </div>
                              <input 
                                type="range" min="50" max="200" 
                                value={editParams.brightness} 
                                onChange={e => setEditParams(prev => ({...prev, brightness: parseInt(e.target.value)}))}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-2">
                                <span>Contraste</span>
                                <span>{editParams.contrast}%</span>
                              </div>
                              <input 
                                type="range" min="50" max="200" 
                                value={editParams.contrast} 
                                onChange={e => setEditParams(prev => ({...prev, contrast: parseInt(e.target.value)}))}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div>
                              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-2">
                                <span>Saturação</span>
                                <span>{editParams.saturation}%</span>
                              </div>
                              <input 
                                type="range" min="0" max="200" 
                                value={editParams.saturation} 
                                onChange={e => setEditParams(prev => ({...prev, saturation: parseInt(e.target.value)}))}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center px-4">
                            Escolha o método de processamento de IA
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2">
                            <button 
                              type="button"
                              onClick={processWithCloudAI}
                              disabled={isProcessing || isCloudProcessing}
                              className={cn(
                                "py-4 px-4 rounded-2xl flex flex-col items-center gap-1 transition-all border-2 text-center",
                                settings?.removeBgApiKey 
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100" 
                                  : "bg-slate-50 border-slate-100 text-slate-400 grayscale"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {isCloudProcessing ? (
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-5 h-5" />
                                )}
                                <span className="font-extrabold text-sm">IA Rápida</span>
                              </div>
                              <span className="text-[9px] font-bold opacity-70">Recorte profissional Instantâneo via Cloud</span>
                            </button>

                            <button 
                              type="button"
                              onClick={() => processWithLocalAI()}
                              disabled={isProcessing || isCloudProcessing}
                              className="py-4 px-4 bg-slate-50 border-2 border-slate-100 text-slate-700 rounded-2xl flex flex-col items-center gap-1 hover:bg-slate-100 transition-all disabled:opacity-50 text-center"
                            >
                              <div className="flex items-center gap-2">
                                {isProcessing ? (
                                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                                ) : (
                                  <Zap className="w-5 h-5 text-amber-500" />
                                )}
                                <span className="font-extrabold text-sm">IA Local (Grátis)</span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-500">Mais lenta (processado no seu computador)</span>
                            </button>
                          </div>
                          
                          {!settings?.removeBgApiKey && (
                            <p className="text-[9px] text-center text-amber-600 font-bold bg-amber-50 py-2 rounded-lg mx-4">
                              Nota: Configure a chave Remove.bg no Painel ADM para usar a IA Rápida.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setIsEditingPhoto(false)}
                        className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all shadow-sm"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button"
                        onClick={applyFilters}
                        className="flex-2 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5" /> Confirmar e Guardar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {photoMode === 'camera' && isCameraActive ? (
                <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-inner">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/png"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "user", aspectRatio: 0.75 }}
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
                      <RefreshCw className="w-8 h-8 animate-spin mb-4 text-emerald-400" />
                      <div className="space-y-1">
                        <p className="font-black text-sm uppercase tracking-widest">Removendo Fundo...</p>
                        <p className="text-[10px] text-white/60">Algoritmo de Segmentação Local</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCameraActive(false)}
                      className="px-4 py-2 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full font-bold text-[10px] uppercase hover:bg-white/30 transition-all"
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={capturePhoto}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-full font-black text-[10px] uppercase flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" /> Capturar Foto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div 
                    className="w-24 h-32 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative group shadow-inner"
                    style={{
                      backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px), radial-gradient(#cbd5e1 1px, #f1f5f9 1px)`,
                      backgroundSize: "12px 12px",
                      backgroundPosition: "0 0, 6px 6px",
                      backgroundColor: "#f8fafc"
                    }}
                  >
                    {formData.photo && formData.photo.trim() !== '' ? (
                      <>
                        <img src={formData.photo} alt="Pré-visualização" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setIsEditingPhoto(true)}
                            className="p-2 bg-white rounded-full text-emerald-600"
                            title="Editar Foto"
                          >
                            <PenTool className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => { setFormData(prev => ({ ...prev, photo: '' })); if (photoMode === 'camera') setIsCameraActive(true); }}
                            className="p-2 bg-white rounded-full text-red-500"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Camera className="text-slate-300 w-8 h-8" />
                        <span className="text-[10px] text-slate-400 font-bold">Sem Foto</span>
                      </div>
                    )}
                    {photoMode === 'upload' && (
                      <input 
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => handleFileChange(e, 'photo')}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 font-medium">
                      {photoMode === 'upload' 
                        ? 'Clique na moldura para carregar um ficheiro de imagem.' 
                        : 'Use a câmara para tirar uma foto instantânea.'}
                    </p>
                    {photoMode === 'camera' && !isCameraActive && formData.photo && (
                      <button 
                        type="button"
                        onClick={() => setIsCameraActive(true)}
                        className="mt-2 text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                      >
                        <RefreshCw className="w-3 h-3" /> Repetir Foto
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fingerprint / Biometrics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Impressão Digital (DigitalPersona)</label>
              {isReaderConnected ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sensor Online
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => (window as any).location.reload()}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 text-slate-400 text-[8px] font-black uppercase border border-slate-100 hover:bg-slate-100 transition-all"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  Sensor Offline (Recarregar)
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative group shadow-inner">
                {formData.fingerprint && formData.fingerprint.trim() !== '' ? (
                  <img src={formData.fingerprint} alt="Impressão Digital" className="w-full h-full object-contain p-2" />
                ) : (
                  <Fingerprint className="text-slate-300 w-8 h-8" />
                )}
                {isBiometricActive && (
                  <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                    <div className="relative">
                      <Fingerprint className="w-8 h-8 text-emerald-600 animate-pulse" />
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-max text-[8px] font-black text-emerald-600 uppercase">Lendo...</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <button 
                  type="button"
                  onClick={captureBiometric}
                  disabled={isBiometricActive}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-emerald-400" /> DigitalPersona Capture
                </button>
                <div className="relative">
                  <button type="button" className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                    <Upload className="w-4 h-4" /> Carregar Manual
                  </button>
                  <input 
                    type="file" 
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={e => handleFileChange(e, 'fingerprint')}
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">
                  Integração nativa com drivers DigitalPersona v2.3. O sensor detectará automaticamente o toque para processamento de alta resolução.
                </p>
              </div>
            </div>
          </div>

          {/* Signature */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assinatura</label>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 border-2 border-slate-200 rounded-2xl bg-white overflow-hidden shadow-inner relative group">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor='black'
                    velocityFilterWeight={0.7}
                    minWidth={1.5}
                    maxWidth={4.5}
                    clearOnResize={false}
                    canvasProps={{
                      className: 'sigCanvas w-full h-44 cursor-crosshair touch-none bg-white'
                    }}
                    onEnd={saveSignature}
                  />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      type="button"
                      onClick={clearSignature}
                      className="p-2 bg-white/90 backdrop-blur-sm text-red-500 rounded-xl hover:bg-red-50 shadow-lg border border-slate-100 transition-all"
                      title="Apagar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={saveSignature}
                      className="p-2 bg-white/90 backdrop-blur-sm text-emerald-600 rounded-xl hover:bg-emerald-50 shadow-lg border border-slate-100 transition-all"
                      title="Confirmar"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="w-full md:w-40 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative group shadow-sm shrink-0">
                  {formData.signature && formData.signature.trim() !== '' ? (
                    <div className="flex flex-col items-center gap-1 w-full h-full p-2">
                       <img src={formData.signature} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => { setFormData(prev => ({ ...prev, signature: '' })); if (sigCanvas.current) sigCanvas.current.clear(); }}
                            className="p-2 bg-white rounded-full text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <PenTool className="text-slate-300 w-6 h-6" />
                      <span className="text-[10px] text-slate-400 font-bold">Pré-visualização</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={e => handleFileChange(e, 'signature')}
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <p className="text-[10px] text-slate-400 flex items-center gap-1 font-medium bg-slate-50 px-3 py-1 rounded-full">
                  <Sparkles className="w-3 h-3 text-emerald-500" /> Desenhe acima ou carregue uma imagem PNG transparente.
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                   <button 
                    type="button"
                    onClick={clearSignature}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 text-slate-600 font-bold text-[9px] uppercase rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3 h-3" /> Limpar
                  </button>
                  <button 
                    type="button"
                    onClick={saveSignature}
                    className="flex-1 sm:flex-none px-5 py-2.5 text-white font-black text-[9px] uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-95"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <Check className="w-4 h-4" /> Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100 flex justify-center">
        <button 
          type="submit"
          className="w-full max-w-md py-5 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99]"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 20px 40px -10px var(--primary)' }}
        >
          <Save className="w-6 h-6" /> 
          Finalizar e Gerar Cartão
        </button>
      </div>
    </form>
  );
};
