'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, AlertCircle, RefreshCw, Link as LinkIcon, CheckCircle2, Upload, Scan } from 'lucide-react';
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
  const { storage } = useFirebase();
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
          width: { min: 1280, ideal: 1920 }, 
          height: { min: 720, ideal: 1080 } 
        } 
      });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Accès caméra refusé',
        description: 'Veuillez autoriser l\'accès dans les paramètres de votre navigateur pour une capture HD.',
      });
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
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleUpload(file);
          closeCamera();
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const handleUpload = async (file: File) => {
    if (!storage) {
      toast({
        variant: 'destructive',
        title: 'Mode manuel activé',
        description: 'Le stockage automatique n\'est pas configuré. Veuillez utiliser un lien direct.',
      });
      setShowUrlInput(true);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
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
          console.error('Upload failed:', error);
          setUploading(false);
          toast({ 
            variant: 'destructive', 
            title: 'Erreur d\'envoi', 
            description: 'L\'envoi a échoué. Basculement vers le mode lien manuel.' 
          });
          setShowUrlInput(true);
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
          toast({
            title: 'Image enregistrée',
            description: 'Le fichier a été ajouté avec succès.',
          });
        }
      );
    } catch (err) {
      console.error("Upload initialization error:", err);
      setUploading(false);
      setShowUrlInput(true);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => handleUpload(file));
    }
    if (e.target) e.target.value = '';
  };

  const removeImage = (urlToRemove: string) => {
    if (multiple) {
      onChange(urls.filter(url => url !== urlToRemove));
    } else {
      onChange('');
    }
  };

  const handleManualUrlChange = (newUrl: string, index?: number) => {
    if (multiple && typeof index === 'number') {
      const newUrls = [...urls];
      newUrls[index] = newUrl;
      onChange(newUrls.filter(u => u !== ''));
    } else {
      onChange(newUrl);
    }
  };

  return (
    <div className="space-y-4">
      {label && <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{label}</label>}
      
      <div className="flex flex-wrap gap-4">
        {urls.map((url, index) => (
          <div key={index} className="relative group w-28 h-28 rounded-xl overflow-hidden border-2 border-muted shadow-lg bg-card transition-all hover:scale-105">
            <Image src={url} alt="Aperçu" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="p-2 bg-destructive text-white rounded-full shadow-xl hover:bg-destructive/90 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute bottom-1 right-1">
               <CheckCircle2 className="h-4 w-4 text-green-500 fill-white" />
            </div>
          </div>
        ))}

        {(multiple || urls.length === 0) && !uploading && (
          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              className="h-28 w-28 flex-col gap-2 border-dashed border-2 rounded-xl bg-muted/20 hover:bg-primary/5 hover:border-primary/50 transition-all group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Upload className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter">Galerie</span>
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="h-28 w-28 flex-col gap-2 border-dashed border-2 rounded-xl bg-muted/20 hover:bg-primary/5 hover:border-primary/50 transition-all group"
              onClick={openCamera}
            >
              <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Camera className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter">Appareil HD</span>
            </Button>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept="image/*" 
              multiple={multiple}
              onChange={onFileSelect} 
            />
          </div>
        )}

        {uploading && (
          <div className="w-28 h-28 flex flex-col items-center justify-center border-2 border-primary/30 rounded-xl bg-primary/5 animate-pulse">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <div className="w-20 px-2">
              <Progress value={progress} className="h-1.5" />
            </div>
            <span className="text-[10px] mt-2 font-black text-primary">{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2">
        <button 
          type="button" 
          className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer l'URL" : "Gérer l'URL manuellement"}
        </button>

        {showUrlInput && (
          <div className="space-y-3 p-4 bg-muted/30 rounded-xl border-2 border-dashed border-muted transition-all animate-in fade-in slide-in-from-top-2">
            {multiple ? (
              <div className="space-y-3">
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input 
                      placeholder="https://..." 
                      value={url} 
                      onChange={(e) => handleManualUrlChange(e.target.value, i)}
                      className="h-9 text-xs font-mono bg-background"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(url)} className="h-9 w-9 text-destructive">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  className="w-full text-[10px] font-black uppercase h-8"
                  onClick={() => onChange([...urls, ""])}
                >
                  Ajouter un autre lien
                </Button>
              </div>
            ) : (
              <Input 
                placeholder="https://..." 
                value={typeof value === 'string' ? value : ''} 
                onChange={(e) => handleManualUrlChange(e.target.value)}
                className="h-9 text-xs font-mono bg-background"
              />
            )}
          </div>
        )}
      </div>

      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-zinc-950 border-none rounded-none sm:rounded-2xl shadow-2xl">
          <DialogHeader className="p-4 bg-white/5 text-white backdrop-blur-2xl absolute top-0 left-0 w-full z-20 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Capture HD
            </DialogTitle>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full uppercase">1080p actif</span>
            </div>
          </DialogHeader>
          
          <div className="relative aspect-[3/4] sm:aspect-video bg-black flex items-center justify-center min-h-[450px]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn("w-full h-full object-cover", !hasCameraPermission && "hidden")} 
            />
            
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="w-[85%] h-[80%] border-2 border-white/20 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    <Scan className="h-32 w-32 text-white" strokeWidth={0.5} />
                  </div>
               </div>
            </div>

            {hasCameraPermission === false && (
              <div className="p-8 text-center text-white space-y-6 z-30">
                <div className="bg-destructive/20 p-5 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-destructive/50">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-bold">Caméra indisponible</p>
                  <p className="text-sm text-zinc-400">L'accès est bloqué ou le matériel n'est pas reconnu.</p>
                </div>
                <Button variant="outline" size="sm" onClick={openCamera} className="text-white border-white/20 bg-white/5 hover:bg-white/10">
                  <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
                </Button>
              </div>
            )}
            
            {hasCameraPermission === null && (
              <div className="flex flex-col items-center gap-4 z-30">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Optimisation du flux...</p>
              </div>
            )}
          </div>

          <div className="p-8 flex justify-center items-center gap-12 bg-gradient-to-t from-black via-black/90 to-transparent relative z-30">
            <Button 
              type="button" 
              variant="outline" 
              size="icon" 
              onClick={closeCamera}
              className="h-14 w-14 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/20 transition-all"
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="relative group">
              <div className="absolute -inset-4 bg-primary/30 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <button 
                type="button" 
                onClick={capturePhoto} 
                disabled={!hasCameraPermission}
                className="h-24 w-24 rounded-full border-[6px] border-white/40 bg-transparent flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
              >
                <div className="w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center">
                   <div className="w-14 h-14 rounded-full border-2 border-black/5" />
                </div>
              </button>
            </div>

            <div className="w-14 h-14" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
