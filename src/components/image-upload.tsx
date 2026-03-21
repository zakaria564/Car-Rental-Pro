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
 * Système de gestion d'images simplifié.
 * Permet de choisir une photo (conversion Base64) ou de coller un lien direct.
 */
export function ImageUpload({ value, onChange, multiple = false }: ImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  
  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessing(true);
    const newUrls = [...urls];

    try {
      for (const file of files) {
        // Limite de 1Mo pour le format Base64 afin de ne pas surcharger Firestore
        if (file.size > 1024 * 1024) {
          toast({
            variant: "destructive",
            title: "Image trop lourde",
            description: "Veuillez choisir une image de moins de 1 Mo pour un chargement rapide.",
          });
          continue;
        }

        const base64 = await fileToBase64(file);
        
        if (multiple) {
          newUrls.push(base64);
        } else {
          onChange(base64);
          setProcessing(false);
          return;
        }
      }
      
      if (multiple) {
        onChange(newUrls);
      }
    } catch (error) {
      console.error("Erreur de conversion:", error);
      toast({
        variant: "destructive",
        title: "Échec du traitement",
        description: "Impossible de lire le fichier photo.",
      });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
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
      {/* Cadre de prévisualisation */}
      <div className={cn(
        "relative w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden bg-muted/5",
        !multiple && "aspect-[16/9]",
        multiple && "min-h-[120px] p-4"
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
                className="absolute top-2 right-2 bg-destructive text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform z-10"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <div className="p-4 rounded-full bg-muted/20">
                <ImageIcon className="h-10 w-10 opacity-30" />
              </div>
              <span className="text-xs font-medium italic">Aucune photo sélectionnée</span>
            </div>
          )
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {urls.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-muted shadow-sm">
                <Image src={url} alt="Aperçu" fill className="object-cover" unoptimized />
                <button 
                  type="button" 
                  onClick={() => removeImage(url)}
                  className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-lg"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {urls.length < 12 && (
               <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Upload className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-bold uppercase">Ajouter</span>
              </button>
            )}
          </div>
        )}
        
        {processing && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs font-bold text-primary">Traitement...</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          disabled={processing}
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-11 rounded-xl font-bold flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Choisir une photo
        </Button>
        
        <div className="relative group">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Ou coller un lien direct (URL)..."
            value={!multiple ? (urls[0] || '') : ''}
            onChange={(e) => !multiple && onChange(e.target.value)}
            className="pl-9 h-11 rounded-xl border-muted-foreground/20 focus:border-primary focus:ring-primary text-xs"
          />
        </div>
      </div>

      {/* Input caché */}
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
