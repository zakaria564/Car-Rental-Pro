
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  // --- Camera Logic ---
  const openCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Accès caméra refusé',
        description: 'Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.',
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
      }, 'image/jpeg', 0.85);
    }
  };

  // --- Upload Logic ---
  const handleUpload = async (file: File) => {
    if (!storage) {
      console.error("Firebase Storage non initialisé. Vérifiez vos variables d'environnement.");
      toast({
        variant: 'destructive',
        title: 'Erreur de configuration',
        description: 'Le service de stockage n\'est pas prêt. Contactez l\'administrateur.',
      });
      return;
    }

    // Validation basique de fichier
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: 'La taille maximum est de 10 Mo.' });
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
        console.error('Upload task error:', error);
        setUploading(false);
        setProgress(0);
        toast({ 
          variant: 'destructive', 
          title: 'Erreur de téléchargement', 
          description: 'Vérifiez votre connexion ou les permissions de stockage.' 
        });
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (multiple) {
            onChange([...urls, downloadURL]);
          } else {
            onChange(downloadURL);
          }
        } catch (err) {
          console.error("Error getting download URL:", err);
          toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de récupérer le lien de l\'image.' });
        } finally {
          setUploading(false);
          setProgress(0);
        }
      }
    );
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => handleUpload(file));
    }
    // Reset input to allow re-selecting the same file
    if (e.target) e.target.value = '';
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
      {label && <label className="text-sm font-medium leading-none">{label}</label>}
      
      <div className="flex flex-wrap gap-3">
        {urls.map((url, index) => (
          <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-muted bg-muted shadow-sm group">
            <Image src={url} alt="Aperçu" fill className="object-cover" unoptimized />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {(multiple || urls.length === 0) && !uploading && (
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-24 w-24 flex-col gap-2 border-dashed border-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all group"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-6 w-6 text-primary/60 group-hover:text-primary transition-colors" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground group-hover:text-primary">Galerie</span>
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-24 w-24 flex-col gap-2 border-dashed border-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all group"
              onClick={openCamera}
            >
              <Camera className="h-6 w-6 text-primary/60 group-hover:text-primary transition-colors" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground group-hover:text-primary">Appareil</span>
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
          <div className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-primary/5 border-primary/30 animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <div className="w-16 px-1">
              <Progress value={progress} className="h-1 bg-primary/20" />
            </div>
            <span className="text-[9px] mt-1 font-black text-primary uppercase tracking-tighter">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      {/* Camera Dialog */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-zinc-950 border-none">
          <DialogHeader className="p-4 bg-white/5 text-white backdrop-blur-xl absolute top-0 left-0 w-full z-10 border-b border-white/10">
            <DialogTitle className="text-white text-center font-bold tracking-tight">Prise de vue</DialogTitle>
          </DialogHeader>
          
          <div className="relative aspect-[3/4] sm:aspect-video bg-black flex items-center justify-center min-h-[400px]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn("w-full h-full object-cover", !hasCameraPermission && "hidden")} 
            />
            {hasCameraPermission === false && (
              <div className="p-8 text-center text-white space-y-6">
                <div className="bg-destructive/20 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-destructive/50">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-bold">Accès impossible</p>
                  <p className="text-sm text-zinc-400">L'accès à votre caméra est bloqué ou non supporté.</p>
                </div>
                <Button variant="outline" size="sm" onClick={openCamera} className="text-white border-white/20 bg-white/5 hover:bg-white/10">
                  <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
                </Button>
              </div>
            )}
            {hasCameraPermission === null && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-zinc-500 text-sm font-medium">Initialisation du capteur...</p>
              </div>
            )}
          </div>

          <div className="p-8 flex justify-center items-center gap-10 bg-gradient-to-t from-black via-black/80 to-transparent">
            <Button 
              type="button" 
              variant="outline" 
              size="icon" 
              onClick={closeCamera}
              className="h-12 w-12 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/20 transition-all"
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="relative group">
              <div className="absolute -inset-2 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Button 
                type="button" 
                onClick={capturePhoto} 
                disabled={!hasCameraPermission}
                className="h-24 w-24 rounded-full border-[6px] border-white/30 bg-transparent hover:bg-transparent transition-all p-1 active:scale-95"
              >
                <div className="w-full h-full bg-white rounded-full shadow-2xl flex items-center justify-center">
                   <div className="w-4 h-4 rounded-full border-2 border-black/10" />
                </div>
              </Button>
            </div>

            <div className="w-12 h-12" /> {/* Spacer pour l'équilibre visuel */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
