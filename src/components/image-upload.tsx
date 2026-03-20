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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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
    
    // Détection immédiate si Storage n'est pas configuré
    if (!storage || !bucket || bucket.includes("YOUR_STORAGE_BUCKET") || bucket === "") {
      setShowUrlInput(true);
      toast({
        title: 'Mode Manuel Activé',
        description: 'Le stockage Cloud n\'est pas encore configuré dans votre console Firebase. Veuillez utiliser des liens directs.',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    // Timeout de sécurité pour éviter de rester bloqué sur "en cours"
    const timeout = setTimeout(() => {
        if (uploading) {
            setUploading(false);
            setShowUrlInput(true);
            toast({
                variant: 'destructive',
                title: 'Délai dépassé',
                description: 'Le serveur met trop de temps à répondre. Passage en mode manuel.'
            });
        }
    }, 8000);

    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `${folder}/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (error) => {
        clearTimeout(timeout);
        console.error('Upload error:', error);
        setUploading(false);
        setShowUrlInput(true);
        toast({ 
          variant: 'destructive', 
          title: 'Erreur d\'envoi', 
          description: 'Vérifiez que le service Storage est activé dans votre console Firebase.' 
        });
      },
      async () => {
        clearTimeout(timeout);
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        if (multiple) {
          onChange([...urls, downloadURL]);
        } else {
          onChange(downloadURL);
        }
        setUploading(false);
        setProgress(0);
        toast({ title: 'Succès', description: 'Image enregistrée avec succès.' });
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
      {label && <label className="text-sm font-bold text-foreground mb-2 block">{label}</label>}
      
      {/* CADRE PHOTO UNIQUE */}
      {!multiple && (
        <div className="space-y-4">
          <div className={cn(
            "relative group w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-dashed transition-all bg-muted/30 flex items-center justify-center shadow-inner",
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
                <div className="absolute bottom-3 right-3 bg-white dark:bg-zinc-900 rounded-full p-1.5 shadow-lg border border-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </>
            ) : uploading ? (
              <div className="flex flex-col items-center gap-4 w-full px-12">
                <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0 [animation-duration:1.5s]" />
                </div>
                <div className="w-full space-y-1">
                    <Progress value={progress} className="h-2 w-full bg-primary/10" />
                    <div className="flex justify-between text-[10px] font-black text-primary uppercase tracking-tighter">
                        <span>Chargement</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3 opacity-30 group-hover:opacity-50 transition-opacity">
                <ImageIcon className="h-20 w-20 mx-auto" strokeWidth={1} />
                <p className="text-xs font-black uppercase tracking-widest">Aucun fichier</p>
              </div>
            )}
          </div>

          {!uploading && !urls[0] && (
            <div className="grid grid-cols-2 gap-4">
              <Button type="button" variant="outline" className="h-14 border-2 rounded-2xl bg-card hover:bg-primary/5 transition-all gap-3 shadow-sm active:scale-95" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-xs font-black uppercase tracking-tight">Galerie</span>
              </Button>
              <Button type="button" variant="outline" className="h-14 border-2 rounded-2xl bg-card hover:bg-primary/5 transition-all gap-3 shadow-sm active:scale-95" onClick={openCamera}>
                <Camera className="h-5 w-5 text-primary" />
                <span className="text-xs font-black uppercase tracking-tight">Caméra</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* GRILLE MULTI-PHOTOS */}
      {multiple && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {urls.map((url, i) => (
              url && (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border bg-muted shadow-sm group">
                  <Image src={url} alt="Doc" fill className="object-cover" unoptimized />
                  <button type="button" onClick={() => removeImage(url)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white backdrop-blur-[1px]">
                    <X className="h-8 w-8" />
                  </button>
                </div>
              )
            ))}
            {!uploading && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary group shadow-sm">
                <Plus className="h-8 w-8 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-tighter">Ajouter</span>
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
            <Button type="button" variant="secondary" className="w-full h-12 rounded-xl text-xs font-black uppercase tracking-widest gap-2" onClick={openCamera}>
              <Camera className="h-4 w-4" /> Prendre une photo
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

      {/* ZONE MANUELLE (URL) */}
      <div className="pt-2 border-t border-dashed mt-4">
        <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2 mx-auto py-2">
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer la saisie manuelle" : "Gérer le lien manuellement (URL)"}
        </button>

        {showUrlInput && (
          <div className="mt-2 p-4 bg-muted/20 rounded-2xl border-2 border-dashed border-muted transition-all animate-in fade-in slide-in-from-top-2">
            <div className="space-y-3">
              {multiple ? (
                <>
                  {urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Lien direct (https://...)" value={url} onChange={(e) => {
                        const newUrls = [...urls];
                        newUrls[i] = e.target.value;
                        onChange(newUrls.filter(u => u !== ''));
                      }} className="h-10 text-xs font-mono rounded-xl bg-card" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(url)} className="h-10 w-10 text-destructive"><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-10 text-[10px] font-black uppercase rounded-xl border-dashed" onClick={() => onChange([...urls, ""])}>+ Ajouter un autre lien</Button>
                </>
              ) : (
                <Input placeholder="Coller l'adresse de l'image ici..." value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} className="h-11 text-xs font-mono rounded-xl bg-card border-2" />
              )}
              <div className="flex items-start gap-2 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-600 leading-tight">
                  <strong>Note:</strong> Utilisez ce champ si le stockage automatique n'est pas activé dans votre console Firebase ou si vous avez déjà un lien externe.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DIALOGUE CAMÉRA HD */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-zinc-950 border-none rounded-none sm:rounded-[2rem] shadow-2xl">
          <div className="relative aspect-video bg-black flex items-center justify-center min-h-[450px]">
            {hasCameraPermission === false ? (
              <div className="text-center text-white p-10 space-y-6">
                <div className="bg-red-500/20 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center animate-pulse"><AlertCircle className="h-12 w-12 text-red-500" /></div>
                <div className="space-y-2">
                    <p className="font-black uppercase tracking-widest text-lg">Accès caméra refusé</p>
                    <p className="text-sm text-zinc-400">Veuillez autoriser l'accès à la caméra dans les réglages de votre navigateur.</p>
                </div>
                <Button variant="outline" onClick={openCamera} className="text-white border-white/20 rounded-full px-8 h-12 font-bold">Réessayer</Button>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                
                {/* OVERLAY DE CADRAGE PROFESSIONNEL */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[85%] h-[75%] border-2 border-white/10 rounded-[2rem] relative">
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-[1.5rem]" />
                    <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-[1.5rem]" />
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-[1.5rem]" />
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-[1.5rem]" />
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                        <Scan className="h-48 w-48 text-white" strokeWidth={0.5} />
                    </div>
                    
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Flux Pro HD Actif</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <div className="p-10 flex justify-between items-center bg-zinc-950">
            <Button type="button" variant="outline" size="icon" onClick={closeCamera} className="h-16 w-16 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/20 active:scale-90 transition-all">
                <X className="h-8 w-8" />
            </Button>
            
            <button 
                type="button" 
                onClick={capturePhoto} 
                disabled={!hasCameraPermission} 
                className="group relative h-28 w-28 rounded-full border-[6px] border-white/20 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
            >
              <div className="w-20 h-20 bg-white rounded-full shadow-[0_0_30px_rgba(255,255,255,0.3)] group-hover:scale-95 transition-transform" />
              <div className="absolute -inset-2 border-2 border-primary rounded-full animate-ping opacity-20 [animation-duration:2s]" />
            </button>
            
            <div className="w-16" /> {/* Spacer pour centrer le déclencheur */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
