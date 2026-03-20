
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
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
      }, 'image/jpeg', 0.8);
    }
  };

  // --- Upload Logic ---
  const handleUpload = async (file: File) => {
    if (!storage) return;
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
        toast({ variant: 'destructive', title: 'Erreur', description: 'Échec du téléchargement.' });
        setUploading(false);
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
      }
    );
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => handleUpload(file));
    }
  };

  const removeImage = async (urlToRemove: string) => {
    if (multiple) {
      onChange(urls.filter(url => url !== urlToRemove));
    } else {
      onChange('');
    }
    // Note: Optionnel, on pourrait supprimer de Firebase Storage ici si on voulait
  };

  return (
    <div className="space-y-4">
      {label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>}
      
      <div className="flex flex-wrap gap-3">
        {urls.map((url, index) => (
          <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted shadow-sm group">
            <Image src={url} alt="Aperçu" fill className="object-cover" unoptimized />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {(multiple || urls.length === 0) && !uploading && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="h-24 w-24 flex-col gap-2 border-dashed border-2 hover:bg-muted/50 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Galerie</span>
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="h-24 w-24 flex-col gap-2 border-dashed border-2 hover:bg-muted/50 transition-all"
                onClick={openCamera}
              >
                <Camera className="h-6 w-6 text-muted-foreground" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Appareil</span>
              </Button>
            </div>
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
          <div className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <div className="w-16 px-1">
              <Progress value={progress} className="h-1" />
            </div>
            <span className="text-[9px] mt-1 font-bold text-primary">{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Camera Dialog */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none">
          <DialogHeader className="p-4 bg-white/10 text-white backdrop-blur-md absolute top-0 left-0 w-full z-10">
            <DialogTitle className="text-white text-center">Prendre une photo</DialogTitle>
          </DialogHeader>
          
          <div className="relative aspect-video bg-black flex items-center justify-center min-h-[300px]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn("w-full h-full object-cover", !hasCameraPermission && "hidden")} 
            />
            {hasCameraPermission === false && (
              <div className="p-6 text-center text-white space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                <p className="text-sm font-medium">Accès à la caméra refusé.</p>
                <Button variant="outline" size="sm" onClick={openCamera} className="text-white border-white">Réessayer</Button>
              </div>
            )}
            {hasCameraPermission === null && <Loader2 className="h-8 w-8 animate-spin text-white" />}
          </div>

          <div className="p-6 flex justify-center items-center gap-8 bg-gradient-to-t from-black to-transparent">
            <Button 
              type="button" 
              variant="outline" 
              size="icon" 
              onClick={closeCamera}
              className="h-12 w-12 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
            <Button 
              type="button" 
              onClick={capturePhoto} 
              disabled={!hasCameraPermission}
              className="h-20 w-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-all p-1"
            >
              <div className="w-full h-full bg-white rounded-full shadow-inner shadow-black/20" />
            </Button>
            <div className="w-12" /> {/* Spacer */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
