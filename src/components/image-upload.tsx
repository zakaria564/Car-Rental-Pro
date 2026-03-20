'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, CheckCircle2, Upload, Scan, AlertCircle, Link as LinkIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface ImageUploadProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  folder: string;
  multiple?: boolean;
  label?: string;
}

export function ImageUpload({ value, onChange, folder, multiple = false, label }: ImageUploadProps) {
  const { storage, app } = useFirebase();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const openCamera = async () => {
    setIsCameraOpen(true);
    setHasCameraPermission(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        } 
      });
      setHasCameraPermission(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Camera error:', error);
      setHasCameraPermission(false);
    }
  };

  const closeCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleUpload(file);
          closeCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const handleUpload = async (file: File) => {
    const bucket = (app as any)?.options?.storageBucket;
    
    if (!storage || !bucket || bucket.includes("YOUR_STORAGE_BUCKET") || bucket === "") {
      setShowUrlInput(true);
      toast({
        title: 'Mode Manuel Activé',
        description: 'Le stockage Firebase n\'est pas encore configuré. Utilisez des liens directs.',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `${folder}/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const timeout = setTimeout(() => {
        uploadTask.cancel();
        setUploading(false);
        setShowUrlInput(true);
        toast({
            variant: 'destructive',
            title: 'Serveur Indisponible',
            description: 'Le transfert est trop lent. Passage en mode manuel (URL).'
        });
    }, 8000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (error: any) => {
        clearTimeout(timeout);
        setUploading(false);
        
        if (error.code === 'storage/canceled') {
          return;
        }

        setShowUrlInput(true);
        console.warn('Upload Error:', error.code);
        toast({ 
          variant: 'destructive', 
          title: 'Une erreur est survenue', 
          description: 'Le stockage automatique n\'est pas disponible. Utilisez le mode manuel.' 
        });
      },
      async () => {
        clearTimeout(timeout);
        try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            if (multiple) {
              onChange([...urls, downloadURL]);
            } else {
              onChange(downloadURL);
            }
            setUploading(false);
            setProgress(0);
            toast({ title: 'Succès', description: 'Photo enregistrée avec succès.' });
        } catch (err) {
            setUploading(false);
            setShowUrlInput(true);
        }
      }
    );
  };

  const removeImage = (urlToRemove: string) => {
    if (multiple) {
      onChange(urls.filter(url => url !== urlToRemove));
    } else {
      onChange('');
    }
  };

  return (
    <div className="space-y-4">
      {label && <label className="text-sm font-bold text-foreground mb-2 block uppercase tracking-wider">{label}</label>}
      
      {!multiple && (
        <div className="space-y-4">
          <div className={cn(
            "relative group w-full aspect-[16/9] rounded-3xl overflow-hidden border-2 border-dashed transition-all bg-muted/20 flex items-center justify-center shadow-inner",
            urls[0] ? "border-primary/20 bg-card" : "border-muted-foreground/20 hover:border-primary/40"
          )}>
            {urls[0] && urls[0].startsWith('http') ? (
              <>
                <Image src={urls[0]} alt="Preview" fill className="object-contain" unoptimized />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeImage(urls[0])} className="h-12 w-12 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                    <X className="h-6 w-6" />
                  </Button>
                </div>
                <div className="absolute bottom-4 right-4 bg-white dark:bg-zinc-900 rounded-full p-2 shadow-lg border border-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </>
            ) : uploading ? (
              <div className="flex flex-col items-center gap-4 w-full px-12">
                <div className="relative">
                    <Loader2 className="h-14 w-14 animate-spin text-primary opacity-20" />
                    <Loader2 className="h-14 w-14 animate-spin text-primary absolute inset-0 [animation-duration:1.5s]" />
                </div>
                <div className="w-full space-y-2">
                    <Progress value={progress} className="h-2 w-full bg-primary/10" />
                    <div className="flex justify-between text-[10px] font-black text-primary uppercase tracking-widest">
                        <span>Transfert en cours</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 px-6 opacity-30 group-hover:opacity-60 transition-all duration-500">
                <div className="relative mx-auto w-32 h-20">
                  <svg viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-muted-foreground">
                    <path d="M5 15V5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M85 15V5H75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M5 45V55H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M85 45V55H75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="25" y="20" width="50" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2"/>
                    <circle cx="50" cy="30" r="12" stroke="currentColor" strokeWidth="1"/>
                    <circle cx="50" cy="30" r="2" fill="currentColor"/>
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Capture Studio Pro</p>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Optimisé pour Car Rental Pro</p>
                </div>
              </div>
            )}
          </div>

          {!uploading && !urls[0] && (
            <div className="grid grid-cols-2 gap-4">
              <Button type="button" variant="outline" className="h-16 border-2 rounded-2xl bg-card hover:bg-primary/5 transition-all gap-3 shadow-sm active:scale-95 group" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black uppercase tracking-tight">Galerie</span>
              </Button>
              <Button type="button" variant="outline" className="h-16 border-2 rounded-2xl bg-card hover:bg-primary/5 transition-all gap-3 shadow-sm active:scale-95 group" onClick={openCamera}>
                <Camera className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black uppercase tracking-tight">Caméra HD</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {multiple && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {urls.map((url, i) => (
              url && (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border bg-muted shadow-md group border-primary/10">
                  <Image src={url} alt="Document" fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white backdrop-blur-[1px] gap-2">
                    <button type="button" onClick={() => removeImage(url)} className="p-2 bg-red-500 rounded-full hover:scale-110 transition-transform">
                        <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )
            ))}
            {!uploading && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary group shadow-inner">
                <Plus className="h-8 w-8 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Ajouter</span>
              </button>
            )}
            {uploading && (
              <div className="aspect-square rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-[10px] font-black text-primary">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
          {!uploading && (
            <Button type="button" variant="secondary" className="w-full h-12 rounded-2xl text-xs font-black uppercase tracking-widest gap-2 shadow-sm" onClick={openCamera}>
              <Camera className="h-4 w-4" /> Prendre une photo HD
            </Button>
          )}
        </div>
      )}

      <input type="file" className="hidden" ref={fileInputRef} accept="image/*" multiple={multiple} onChange={(e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          if (multiple) Array.from(files).forEach(f => handleUpload(f));
          else handleUpload(files[0]);
        }
        e.target.value = '';
      }} />

      <div className="pt-2 border-t border-dashed mt-4">
        <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all flex items-center gap-2 mx-auto py-3">
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer la gestion manuelle" : "Gérer les liens manuellement (URL)"}
        </button>

        {showUrlInput && (
          <div className="mt-2 p-5 bg-muted/10 rounded-3xl border-2 border-dashed border-muted transition-all animate-in fade-in slide-in-from-top-2">
            <div className="space-y-4">
              {multiple ? (
                <>
                  {urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Lien direct (https://...)" value={url} onChange={(e) => {
                        const newUrls = [...urls];
                        newUrls[i] = e.target.value;
                        onChange(newUrls.filter(u => u !== ''));
                      }} className="h-12 text-xs font-mono rounded-2xl bg-card border-primary/10" />
                      <button type="button" onClick={() => removeImage(url)} className="h-12 w-12 flex items-center justify-center text-destructive bg-destructive/5 hover:bg-destructive/10 rounded-xl"><X className="h-5 w-5" /></button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-12 text-[10px] font-black uppercase rounded-2xl border-dashed bg-card" onClick={() => onChange([...urls, ""])}>+ Ajouter un autre lien</Button>
                </>
              ) : (
                <Input placeholder="Coller le lien de l'image ici..." value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} className="h-14 text-xs font-mono rounded-2xl bg-card border-2 border-primary/10 focus:border-primary/30" />
              )}
              <div className="flex items-start gap-3 p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="text-[10px] text-amber-700/80 leading-relaxed font-medium">
                  <p><strong>NOTE TECHNIQUE :</strong> Utilisez ce champ si le stockage automatique n'est pas activé ou si le réseau est trop lent.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-zinc-950 border-none rounded-none sm:rounded-[3rem] shadow-2xl">
          <DialogHeader className="p-0">
            <DialogTitle className="sr-only">Capture Caméra Pro HD</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video bg-black flex items-center justify-center min-h-[500px]">
            {hasCameraPermission === false ? (
              <div className="text-center text-white p-12 space-y-8">
                <div className="bg-red-500/20 p-8 rounded-full w-28 h-28 mx-auto flex items-center justify-center animate-pulse"><AlertCircle className="h-14 w-14 text-red-500" /></div>
                <div className="space-y-3">
                    <p className="font-black uppercase tracking-[0.2em] text-xl">Accès caméra refusé</p>
                    <p className="text-sm text-zinc-400">Veuillez autoriser l'accès à votre caméra dans les réglages de votre navigateur.</p>
                </div>
                <Button variant="outline" onClick={openCamera} className="text-white border-white/20 rounded-full px-10 h-14 font-black uppercase text-xs tracking-widest bg-white/5 hover:bg-white/10 transition-all">Réessayer l'accès</Button>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[85%] h-[75%] border-2 border-white/10 rounded-[2.5rem] relative">
                    <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-primary rounded-tl-[2rem]" />
                    <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-primary rounded-tr-[2rem]" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-primary rounded-bl-[2rem]" />
                    <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-primary rounded-br-[2rem]" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.05]">
                        <Scan className="h-64 w-64 text-white" strokeWidth={0.5} />
                    </div>
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-6 py-2.5 rounded-full border border-white/10 flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Flux Pro HD Actif</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="p-12 flex justify-between items-center bg-zinc-950/90 backdrop-blur-3xl">
            <Button type="button" variant="outline" size="icon" onClick={closeCamera} className="h-16 w-16 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/20 active:scale-90 transition-all shadow-xl">
                <X className="h-8 w-8" />
            </Button>
            <button 
                type="button" 
                onClick={capturePhoto} 
                disabled={!hasCameraPermission} 
                className="group relative h-32 w-32 rounded-full border-[8px] border-white/10 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
            >
              <div className="w-22 h-22 bg-white rounded-full shadow-[0_0_40px_rgba(255,255,255,0.4)] group-hover:scale-95 transition-transform" />
              <div className="absolute -inset-3 border-2 border-primary rounded-full animate-ping opacity-20 [animation-duration:2.5s]" />
            </button>
            <div className="w-16 h-16" /> {/* Spacer */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
