'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, Plus, AlertCircle, Link as LinkIcon, Upload } from 'lucide-react';
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
            title: 'Délai dépassé',
            description: 'Passage en mode manuel (URL).'
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
        if (error.code !== 'storage/canceled') {
          setShowUrlInput(true);
          toast({ 
            variant: 'destructive', 
            title: 'Erreur de transfert', 
            description: 'Utilisez le mode manuel.' 
          });
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
        <div className="space-y-4">
          {/* Cadre d'affichage principal */}
          <div 
            onClick={() => !urls[0] && !uploading && fileInputRef.current?.click()}
            className={cn(
              "relative group w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-dashed transition-all bg-muted/20 flex items-center justify-center shadow-inner cursor-pointer",
              urls[0] ? "border-primary/20 bg-card" : "border-muted-foreground/20 hover:border-primary/40"
            )}
          >
            {urls[0] && urls[0].startsWith('http') ? (
              <>
                <Image src={urls[0]} alt="Preview" fill className="object-contain" unoptimized />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <Button type="button" variant="destructive" size="icon" onClick={(e) => { e.stopPropagation(); removeImage(urls[0]); }} className="h-10 w-10 rounded-full">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </>
            ) : uploading ? (
              <div className="flex flex-col items-center gap-2 w-full px-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <Progress value={progress} className="h-1.5 w-full max-w-[150px]" />
                <span className="text-[10px] font-bold text-primary uppercase">{Math.round(progress)}%</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity">
                <ImageIcon className="h-12 w-12" />
                <span className="text-xs font-medium uppercase tracking-widest">Choisir une photo</span>
              </div>
            )}
          </div>

          {/* Boutons Galerie/Caméra */}
          {!uploading && (
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="h-12 rounded-xl text-xs font-bold gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Galerie
              </Button>
              <Button type="button" variant="outline" className="h-12 rounded-xl text-xs font-bold gap-2" onClick={openCamera}>
                <Camera className="h-4 w-4" /> Caméra HD
              </Button>
            </div>
          )}
        </div>
      )}

      {multiple && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {urls.map((url, i) => (
              url && (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-muted group shadow-sm">
                  <Image src={url} alt="Document" fill className="object-cover" unoptimized />
                  <button type="button" onClick={() => removeImage(url)} className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            ))}
            {!uploading && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/40 transition-all text-muted-foreground hover:text-primary">
                <Plus className="h-6 w-6" />
                <span className="text-[9px] font-bold uppercase">Ajouter</span>
              </button>
            )}
            {uploading && (
              <div className="aspect-square rounded-xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-1">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-[9px] font-bold text-primary">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
          {!uploading && (
            <Button type="button" variant="secondary" className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest gap-2" onClick={openCamera}>
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

      {/* Mode Manuel (URL) discret */}
      <div className="pt-2 border-t border-dashed mt-2">
        <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2 mx-auto py-2">
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer l'URL" : "Gérer par URL"}
        </button>

        {showUrlInput && (
          <div className="mt-2 p-4 bg-muted/10 rounded-xl border border-dashed transition-all">
            <div className="space-y-3">
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
                <p className="text-[9px] text-amber-700/80 font-medium">Note : Utilisez ce champ si le stockage automatique n'est pas activé.</p>
              </div>
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
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
          </div>
          <div className="p-8 flex justify-between items-center bg-zinc-900">
            <Button type="button" variant="outline" size="icon" onClick={closeCamera} className="h-12 w-12 rounded-full border-white/10 bg-white/5 text-white">
                <X className="h-6 w-6" />
            </Button>
            <button 
                type="button" 
                onClick={capturePhoto} 
                disabled={!hasCameraPermission} 
                className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 bg-white rounded-full shadow-lg" />
            </button>
            <div className="w-12 h-12" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
