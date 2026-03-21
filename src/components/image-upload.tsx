'use client';

import React, { useRef, useState } from 'react';
import { ImageIcon, LinkIcon, Upload, X, Loader2, Image as ImageIconLucide } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  folder?: string;
  multiple?: boolean;
}

/**
 * Composant ImageUpload simplifié utilisant la conversion Base64.
 * Avantage : Pas besoin de configurer Firebase Storage, l'image est stockée en texte.
 */
export function ImageUpload({ value, onChange, multiple = false }: ImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  
  // Normalisation des données
  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessing(true);
    const newUrls = [...urls];

    try {
      for (const file of files) {
        // Limite de taille pour le Base64 (recommandé < 1Mo pour Firestore)
        if (file.size > 1024 * 1024) {
          toast({
            variant: "destructive",
            title: "Image trop volumineuse",
            description: "Pour un enregistrement rapide, préférez des images de moins de 1 Mo.",
          });
          continue;
        }

        const base64 = await fileToBase64(file);
        
        if (multiple) {
          newUrls.push(base64);
        } else {
          // Mode unique : on remplace
          onChange(base64);
          setProcessing(false);
          return;
        }
      }
      
      if (multiple) {
        onChange(newUrls);
      }
    } catch (error) {
      console.error("Erreur conversion Base64:", error);
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
      {/* Cadre de prévisualisation (Mode Photo Unique) */}
      {!multiple && (
        <div className={cn(
          "relative aspect-[16/9] w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden bg-muted/10 transition-all",
          urls[0] ? "border-primary/50 bg-muted/20" : "border-muted-foreground/20"
        )}>
          {urls[0] ? (
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
                className="absolute top-2 right-2 bg-destructive text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform z-10"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIconLucide className="h-10 w-10 opacity-20" />
              <span className="text-xs font-medium italic">Aucune photo sélectionnée</span>
            </div>
          )}
          
          {processing && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-bold text-primary">Conversion...</span>
            </div>
          )}
        </div>
      )}

      {/* Grille pour les inspections (Mode Multi-Photos) */}
      {multiple && urls.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {urls.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted shadow-sm group">
              <Image src={url} alt="Aperçu" fill className="object-cover" unoptimized />
              <button 
                type="button" 
                onClick={() => removeImage(url)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {processing && (
            <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      {/* Zone d'actions */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={processing}
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all font-bold text-sm shadow-md active:scale-95 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Choisir une photo
        </button>
        
        <div className="relative">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ou collez l'adresse URL ici..."
            value={!multiple ? (urls[0] || '') : ''}
            onChange={(e) => !multiple && onChange(e.target.value)}
            className="pl-9 h-11 rounded-xl border-muted-foreground/20 focus:border-primary transition-all text-xs"
          />
        </div>
        
        <p className="text-[10px] text-muted-foreground italic text-center px-2">
          Note : Les photos sont converties en texte (Base64) pour un stockage immédiat sans serveur.
        </p>
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
