'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, CheckCircle2, Upload, Scan, AlertTriangle, Link as LinkIcon, Plus } from 'lucide-react';
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
  const { storage, app, auth } = useFirebase();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
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
        description: 'Veuillez autoriser l\'accès dans les paramètres de votre navigateur.',
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
      }, 'image/jpeg', 0.90);
    }
  };

  const handleUpload = async (file: File) => {
    const bucket = (app as any)?.options?.storageBucket;
    
    if (!auth?.currentUser) {
        toast({
            variant: 'destructive',
            title: 'Session expirée',
            description: 'Veuillez vous reconnecter pour envoyer des photos.',
        });
        return;
    }

    if (!storage || !bucket || bucket.includes("YOUR_STORAGE_BUCKET")) {
      setUploading(false);
      setShowUrlInput(true);
      toast({
        variant: 'destructive',
        title: 'Stockage désactivé',
        description: 'Veuillez utiliser le mode manuel (URL).',
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setIsStuck(false);

    // Timeout de sécurité si l'upload ne démarre jamais (souvent problème de règles Firebase)
    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
    uploadTimeoutRef.current = setTimeout(() => {
      if (progress === 0) {
        setIsStuck(true);
      }
    }, 5000);

    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `${folder}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
          if (p > 0) {
            setIsStuck(false);
            if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
          }
        },
        (error) => {
          console.error('Upload task failed:', error);
          setUploading(false);
          setIsStuck(false);
          if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
          toast({ 
            variant: 'destructive', 
            title: 'Erreur d\'envoi', 
            description: 'Problème de connexion. Utilisez le mode manuel.' 
          });
          setShowUrlInput(true);
        },
        async () => {
          if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (multiple) {
            onChange([...urls, downloadURL]);
          } else {
            onChange(downloadURL);
          }
          setUploading(false);
          setProgress(0);
          setIsStuck(false);
          toast({
            title: 'Image enregistrée',
            description: 'La photo a été ajoutée avec succès.',
          });
        }
      );
    } catch (err) {
      console.error("Upload initialization failed:", err);
      setUploading(false);
      setIsStuck(false);
      if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
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

  const cancelUpload = () => {
    setUploading(false);
    setIsStuck(false);
    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
    setShowUrlInput(true);
  };

  const renderSinglePreview = () => {
    const url = urls[0];
    const hasImage = url && url.startsWith('http');

    return (
      <div className="space-y-4">
        {/* Cadre de prévisualisation principal */}
        <div className="relative group w-full aspect-video sm:aspect-[16/9] rounded-2xl overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-muted/10 shadow-sm transition-all hover:border-primary/30">
          {hasImage ? (
            <>
              <Image src={url} alt="Prévisualisation" fill className="object-contain" unoptimized />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeImage(url)}
                  className="rounded-full shadow-lg h-10 w-10 p-0"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="absolute bottom-3 right-3">
                 <div className="bg-white rounded-full p-1 shadow-md">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                 </div>
              </div>
            </>
          ) : uploading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
               {isStuck ? (
                  <div className="text-center p-4">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-amber-600 mb-2 uppercase">Blocage détecté</p>
                    <Button variant="outline" size="sm" onClick={cancelUpload} className="h-7 text-[10px] bg-amber-50 border-amber-200">
                      MODE MANUEL
                    </Button>
                  </div>
               ) : (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                    <div className="w-32">
                      <Progress value={progress} className="h-2" />
                    </div>
                    <span className="text-xs mt-2 font-black text-primary">{Math.round(progress)}%</span>
                  </>
               )}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 p-6">
              <ImageIcon className="h-16 w-16 mb-2 opacity-20" />
              <p className="text-xs font-medium italic">Aucune image sélectionnée</p>
            </div>
          )}
        </div>

        {/* Boutons d'action clairs */}
        {!hasImage && !uploading && (
          <div className="grid grid-cols-2 gap-3">
            <Button 
              type="button" 
              variant="outline" 
              className="h-12 flex items-center justify-center gap-2 border-2 rounded-xl bg-card hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-tight">Galerie</span>
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="h-12 flex items-center justify-center gap-2 border-2 rounded-xl bg-card hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={openCamera}
            >
              <Camera className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-tight">Caméra</span>
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderMultiplePreview = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {urls.map((url, index) => (
            url && url.startsWith('http') && (
              <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-muted shadow-sm bg-card transition-all hover:scale-105">
                <Image src={url} alt="Aperçu" fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="p-1.5 bg-destructive text-white rounded-full shadow-xl hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          ))}

          {!uploading && (
            <button 
              type="button" 
              className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl bg-muted/20 hover:bg-primary/5 hover:border-primary/50 transition-all group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground group-hover:text-primary">Ajouter</span>
            </button>
          )}

          {uploading && (
            <div className="aspect-square flex flex-col items-center justify-center border-2 border-primary/30 rounded-xl bg-primary/5">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-[10px] mt-1 font-bold text-primary">{Math.round(progress)}%</span>
            </div>
          )}
        </div>

        {!uploading && (
           <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="w-full h-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            onClick={openCamera}
          >
            <Camera className="h-3.5 w-3.5 mr-2" />
            Prendre une photo
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {label && <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 mb-2 block">{label}</label>}
      
      {multiple ? renderMultiplePreview() : renderSinglePreview()}

      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept="image/*" 
        multiple={multiple}
        onChange={onFileSelect} 
      />

      {/* Gestion de l'URL Manuelle */}
      <div className="pt-2">
        <button 
          type="button" 
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer la gestion URL" : "Gérer l'URL manuellement"}
        </button>

        {showUrlInput && (
          <div className="mt-3 space-y-3 p-4 bg-muted/30 rounded-xl border-2 border-dashed border-muted transition-all animate-in fade-in slide-in-from-top-2">
            {multiple ? (
              <div className="space-y-3">
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input 
                      placeholder="Lien de l'image (https://...)" 
                      value={url} 
                      onChange={(e) => {
                        const newUrls = [...urls];
                        newUrls[i] = e.target.value;
                        onChange(newUrls.filter(u => u !== ''));
                      }}
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
                placeholder="Lien de l'image (https://...)" 
                value={typeof value === 'string' ? value : ''} 
                onChange={(e) => onChange(e.target.value)}
                className="h-9 text-xs font-mono bg-background"
              />
            )}
            <p className="text-[9px] text-muted-foreground italic">
              * Utilisez ce champ si le téléchargement automatique est indisponible.
            </p>
          </div>
        )}
      </div>

      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-zinc-950 border-none rounded-none sm:rounded-2xl shadow-2xl">
          <DialogHeader className="p-4 bg-white/5 text-white backdrop-blur-2xl absolute top-0 left-0 w-full z-20 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              PRO CAPTURE HD
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
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-bold">Caméra indisponible</p>
                  <p className="text-sm text-zinc-400">L'accès est bloqué ou le matériel n'est pas reconnu.</p>
                </div>
                <Button variant="outline" size="sm" onClick={openCamera} className="text-white border-white/20 bg-white/5 hover:bg-white/10">
                  Réessayer
                </Button>
              </div>
            )}
            
            {hasCameraPermission === null && (
              <div className="flex flex-col items-center gap-4 z-30">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Initialisation...</p>
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
