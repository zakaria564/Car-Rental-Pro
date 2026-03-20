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
    
    // Si le bucket n'est pas configuré, on bascule en manuel immédiatement
    if (!storage || !bucket || bucket.includes("YOUR_STORAGE_BUCKET")) {
      setShowUrlInput(true);
      toast({
        title: 'Mode URL activé',
        description: 'Le stockage Firebase n\'est pas encore configuré. Vous pouvez coller un lien direct.',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

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
        console.error('Upload error:', error);
        setUploading(false);
        setShowUrlInput(true);
        toast({ 
          variant: 'destructive', 
          title: 'Erreur d\'envoi', 
          description: 'Passage en mode URL manuelle.' 
        });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        if (multiple) {
          onChange([...urls, downloadURL]);
        } else {
          onChange(downloadURL);
        }
        setUploading(false);
        setProgress(0);
        toast({ title: 'Succès', description: 'Image enregistrée.' });
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
      
      {/* SINGLE UPLOAD FRAME */}
      {!multiple && (
        <div className="space-y-4">
          <div className={cn(
            "relative group w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-dashed transition-all bg-muted/30 flex items-center justify-center",
            urls[0] ? "border-primary/20" : "border-muted-foreground/20 hover:border-primary/40"
          )}>
            {urls[0] && urls[0].startsWith('http') ? (
              <>
                <Image src={urls[0]} alt="Preview" fill className="object-contain" unoptimized />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeImage(urls[0])} className="h-10 w-10 rounded-full shadow-xl">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="absolute bottom-3 right-3 bg-background rounded-full p-1 shadow-lg border border-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </>
            ) : uploading ? (
              <div className="flex flex-col items-center gap-3 w-full px-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <Progress value={progress} className="h-2 w-full" />
                <span className="text-xs font-black text-primary">{Math.round(progress)}%</span>
              </div>
            ) : (
              <div className="text-center space-y-2 opacity-40">
                <ImageIcon className="h-16 w-16 mx-auto" strokeWidth={1} />
                <p className="text-xs font-medium italic">Aucun fichier sélectionné</p>
              </div>
            )}
          </div>

          {!uploading && !urls[0] && (
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="h-12 border-2 rounded-xl bg-card hover:bg-primary/5 transition-all gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-tight">Galerie</span>
              </Button>
              <Button type="button" variant="outline" className="h-12 border-2 rounded-xl bg-card hover:bg-primary/5 transition-all gap-2" onClick={openCamera}>
                <Camera className="h-4 w-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-tight">Caméra</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* MULTIPLE UPLOAD GRID */}
      {multiple && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {urls.map((url, i) => (
              url && (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-muted shadow-sm group">
                  <Image src={url} alt="Doc" fill className="object-cover" unoptimized />
                  <button type="button" onClick={() => removeImage(url)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              )
            ))}
            {!uploading && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary">
                <Plus className="h-6 w-6" />
                <span className="text-[10px] font-black uppercase">Ajouter</span>
              </button>
            )}
            {uploading && (
              <div className="aspect-square rounded-xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-1">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-[10px] font-bold text-primary">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
          {!uploading && (
            <Button type="button" variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={openCamera}>
              <Camera className="h-3.5 w-3.5 mr-2" /> Prendre une photo
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

      {/* MANUAL URL INPUT TOGGLE */}
      <div className="pt-2">
        <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2">
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer la saisie manuelle" : "Gérer le lien manuellement"}
        </button>

        {showUrlInput && (
          <div className="mt-3 p-4 bg-muted/20 rounded-xl border border-dashed border-muted transition-all">
            <div className="space-y-3">
              {multiple ? (
                <>
                  {urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Lien direct (https://...)" value={url} onChange={(e) => {
                        const newUrls = [...urls];
                        newUrls[i] = e.target.value;
                        onChange(newUrls.filter(u => u !== ''));
                      }} className="h-9 text-xs font-mono" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(url)} className="h-9 w-9 text-destructive"><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" className="w-full h-8 text-[10px] font-black uppercase" onClick={() => onChange([...urls, ""])}>+ Autre lien</Button>
                </>
              ) : (
                <Input placeholder="Lien direct (https://...)" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} className="h-9 text-xs font-mono" />
              )}
              <p className="text-[9px] text-muted-foreground italic flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Utilisez ce champ si l'envoi automatique est indisponible.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CAMERA DIALOG */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-zinc-950 border-none rounded-none sm:rounded-3xl shadow-2xl">
          <div className="relative aspect-video bg-black flex items-center justify-center min-h-[450px]">
            {hasCameraPermission === false ? (
              <div className="text-center text-white p-10 space-y-4">
                <div className="bg-red-500/20 p-5 rounded-full w-20 h-20 mx-auto flex items-center justify-center"><AlertCircle className="h-10 w-10 text-red-500" /></div>
                <p className="font-bold">Accès caméra refusé</p>
                <Button variant="outline" onClick={openCamera} className="text-white border-white/20">Réessayer</Button>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[85%] h-[80%] border-2 border-white/20 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-10"><Scan className="h-32 w-32 text-white" /></div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="p-8 flex justify-center items-center gap-10 bg-zinc-950">
            <Button type="button" variant="outline" size="icon" onClick={closeCamera} className="h-14 w-14 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/20"><X className="h-6 w-6" /></Button>
            <button type="button" onClick={capturePhoto} disabled={!hasCameraPermission} className="h-24 w-24 rounded-full border-[6px] border-white/40 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50">
              <div className="w-16 h-16 bg-white rounded-full shadow-2xl" />
            </button>
            <div className="w-14" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
