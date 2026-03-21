'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, ImageIcon, LinkIcon, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  folder?: string;
  multiple?: boolean;
}

/**
 * Elite Media Suite - Version Base64 avec Compression Automatique
 * Appliquée à toute l'application pour éviter les erreurs de taille Firestore.
 */
export function ImageUpload({ value, onChange, multiple = false }: ImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  
  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  // Fonction de compression intelligente pour garantir le stockage Base64
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Limite à 1200px pour un équilibre parfait qualité/poids
          const MAX_SIZE = 1200;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error("Canvas context failed"));
          
          ctx.drawImage(img, 0, 0, width, height);

          // Export en JPEG qualité 0.7 (très léger pour Base64)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Image loading failed"));
      };
      reader.onerror = () => reject(new Error("File reading failed"));
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessing(true);
    const newUrls = [...urls];

    try {
      for (const file of files) {
        const optimizedBase64 = await compressImage(file);
        
        if (multiple) {
          newUrls.push(optimizedBase64);
        } else {
          onChange(optimizedBase64);
          setProcessing(false);
          return;
        }
      }
      
      if (multiple) {
        onChange(newUrls);
      }
    } catch (error) {
      console.error("Compression Error:", error);
      toast({
        variant: "destructive",
        title: "Erreur de traitement",
        description: "L'image est peut-être corrompue ou trop lourde.",
      });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (urlToRemove: string) => {
    if (multiple) {
      onChange(urls.filter(u => u !== urlToRemove));
    } else {
      onChange('');
    }
  };

  return (
    <div className="space-y-4">
      <div className={cn(
        "relative w-full rounded-xl border-2 border-dashed transition-all overflow-hidden bg-muted/10",
        !multiple && "aspect-[16/9]",
        multiple && "min-h-[100px] p-2"
      )}>
        {!multiple ? (
          urls[0] ? (
            <>
              <Image 
                src={urls[0]} 
                alt="Aperçu" 
                fill 
                className="object-contain" 
                unoptimized 
              />
              <button 
                type="button" 
                onClick={() => removeImage(urls[0])}
                className="absolute top-2 right-2 bg-destructive text-white p-1 rounded-full shadow hover:scale-110 transition-transform z-20"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs italic">Aucune photo sélectionnée</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {urls.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                <Image src={url} alt="Aperçu" fill className="object-cover" unoptimized />
                <button 
                  type="button" 
                  onClick={() => removeImage(url)}
                  className="absolute top-1 right-1 bg-destructive text-white p-0.5 rounded shadow z-20"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {urls.length < 10 && (
               <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-background"
              >
                <Upload className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-bold uppercase">Ajouter</span>
              </button>
            )}
          </div>
        )}
        
        {processing && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-semibold">Optimisation...</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={processing}
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-10 rounded-lg font-semibold flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Choisir une photo
        </Button>
        
        <div className="relative">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ou lien direct (URL)..."
            value={!multiple ? (urls[0] || '') : ''}
            onChange={(e) => !multiple && onChange(e.target.value)}
            className="pl-9 h-10 rounded-lg text-xs"
          />
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        multiple={multiple} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}
