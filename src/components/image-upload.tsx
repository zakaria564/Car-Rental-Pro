'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, Plus, AlertCircle, Link as LinkIcon, Upload, CheckCircle2, Trash2, Pencil } from 'lucide-react';
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
        title: "Mode Manuel",
        description: "Configuration Storage manquante. Passage en mode URL."
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
    }, 5000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (error: any) => {
        clearTimeout(timeout);
        setUploading(false);
        if (error.code !== 'storage/canceled') {
          setShowUrlInput(true);
        }
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
        <div className="relative group w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-dashed transition-all bg-muted/20 flex items-center justify-center shadow-inner border-muted-foreground/20 hover:border-primary/40">
          {urls[0] ? (
            <>
              <Image src={urls[0]} alt="Preview" fill className="object-contain" unoptimized />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-full gap-2">
                  <Pencil className="h-4 w-4" /> Modifier
                </Button>
                <Button type="button" variant="destructive" size="icon" onClick={() => removeImage(urls[0])} className="h-9 w-9 rounded-full">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="absolute bottom-3 right-3">
                <div className="bg-green-500 text-white p-1 rounded-full shadow-lg">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
            </>
          ) : uploading ? (
            <div className="flex flex-col items-center gap-3 px-8 w-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="w-full space-y-1">
                <Progress value={progress} className="h-1.5 w-full" />
                <p className="text-[10px] font-bold text-center text-primary uppercase tracking-widest">{Math.round(progress)}%</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-background rounded-full shadow-sm border group-hover:scale-110 transition-transform">
                <ImageIcon className="h-8 w-8 text-muted-foreground opacity-40" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold uppercase rounded-lg">Galerie</Button>
                  <Button type="button" variant="outline" size="sm" onClick={openCamera} className="text-xs font-bold uppercase rounded-lg">Caméra</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {multiple && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {urls.map((url, i) => (
            url && (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-muted group shadow-sm ring-1 ring-black/5">
                <Image src={url} alt="Document" fill className="object-cover" unoptimized />
                <button type="button" onClick={() => removeImage(url)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          ))}
          {!uploading && (
            <div className="flex flex-col gap-2">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/40 transition-all text-muted-foreground hover:text-primary bg-muted/10 group"
              >
                <div className="p-2 bg-background rounded-full shadow-sm border group-hover:scale-110 transition-transform">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-tighter">Galerie</span>
              </button>
              <Button type="button" variant="secondary" size="sm" className="h-8 rounded-lg text-[9px] font-bold uppercase tracking-widest gap-1.5" onClick={openCamera}>
                <Camera className="h-3.5 w-3.5" /> Caméra
              </Button>
            </div>
          )}
          {uploading && (
            <div className="aspect-square rounded-xl border-2 border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-[10px] font-black text-primary">{Math.round(progress)}%</span>
            </div>
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

      {/* Bouton Mode Manuel discret */}
      <div className="pt-2">
        <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2 py-1">
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer le mode URL" : "Problème ? Mode Manuel (URL)"}
        </button>

        {showUrlInput && (
          <div className="mt-2 p-4 bg-muted/10 rounded-xl border border-dashed transition-all space-y-3">
            {multiple ? (
              <>
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Lien direct (https://...)" value={url} onChange={(e) => {
                      const newUrls = [...urls];
                      newUrls[i] = e.target.value;
                      onChange(newUrls.filter(u => u !== ''));
                    }} className="h-10 text-xs rounded-lg bg-card" />
                    <button type="button" onClick={() => removeImage(url)} className="h-10 w-10 flex items-center justify-center text-destructive bg-destructive/5 hover:bg-destructive/10 rounded-lg"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full h-10 text-[9px] font-bold uppercase rounded-lg border-dashed" onClick={() => onChange([...urls, ""])}>+ Ajouter une autre URL</Button>
              </>
            ) : (
              <Input placeholder="Coller le lien de l'image ici..." value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} className="h-12 text-xs rounded-lg bg-card border-primary/10" />
            )}
            <div className="flex items-start gap-2 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-[9px] text-amber-700/80 font-medium leading-tight">Note : Le stockage automatique n'est pas prêt. Veuillez coller un lien direct vers une image.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-zinc-950 border-none rounded-none sm:rounded-3xl shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Appareil Photo HD</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video bg-black flex items-center justify-center min-h-[400px]">
            {hasCameraPermission === false ? (
              <div className="text-center text-white p-8 space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <p className="font-bold uppercase tracking-widest text-sm">Accès caméra refusé</p>
                <Button variant="outline" onClick={openCamera} className="text-white border-white/20 rounded-full h-12 font-bold uppercase text-xs">Réessayer</Button>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-white/20 rounded-xl m-8 pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
                <div className="absolute top-4 left-4 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Flux Pro HD</span>
                </div>
              </>
            )}
          </div>
          <div className="p-8 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl">
            <Button type="button" variant="outline" size="icon" onClick={closeCamera} className="h-12 w-12 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors">
                <X className="h-6 w-6" />
            </Button>
            <button 
                type="button" 
                onClick={capturePhoto} 
                disabled={!hasCameraPermission} 
                className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform shadow-2xl disabled:opacity-50"
            >
              <div className="w-16 h-16 bg-white rounded-full shadow-inner" />
            </button>
            <div className="w-12 h-12" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
