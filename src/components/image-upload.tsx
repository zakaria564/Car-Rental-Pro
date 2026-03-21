'use client';

import React, { useRef, useState } from 'react';
import { ImageIcon, LinkIcon, Upload, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  folder?: string;
  multiple?: boolean;
}

/**
 * Composant simplifié pour gérer les images :
 * 1. Bouton pour choisir un fichier (Upload automatique vers Firebase Storage)
 * 2. Champ texte pour coller directement une URL
 */
export function ImageUpload({ value, onChange, folder = 'general', multiple = false }: ImageUploadProps) {
  const { storage } = useFirebase();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  // Normalisation des URLs en tableau
  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!storage) {
      toast({
        variant: "destructive",
        title: "Configuration requise",
        description: "Firebase Storage n'est pas activé. Veuillez coller l'URL manuellement.",
      });
      return;
    }

    setUploading(true);
    const newUrls = [...urls];

    try {
      for (const file of files) {
        // Création d'une référence unique pour le fichier
        const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
        
        // Téléchargement
        const snapshot = await uploadBytes(fileRef, file);
        
        // Récupération de l'URL publique
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        if (multiple) {
          newUrls.push(downloadURL);
        } else {
          // Mode simple : on remplace la valeur
          onChange(downloadURL);
          setUploading(false);
          return;
        }
      }
      
      if (multiple) {
        onChange(newUrls);
      }
    } catch (error: any) {
      console.error("Erreur Upload:", error);
      toast({
        variant: "destructive",
        title: "Échec de l'envoi",
        description: "Vérifiez que le service Storage est actif dans votre console Firebase.",
      });
    } finally {
      setUploading(false);
      // Reset de l'input pour permettre de choisir le même fichier deux fois
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
      {/* Zone de prévisualisation (Mode Simple) */}
      {!multiple && (
        <div className={cn(
          "relative aspect-video w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden bg-muted/10 transition-all",
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
              <ImageIcon className="h-10 w-10 opacity-20" />
              <span className="text-xs font-medium">Aucune image sélectionnée</span>
            </div>
          )}
          
          {uploading && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-bold text-primary">Téléchargement...</span>
            </div>
          )}
        </div>
      )}

      {/* Grille de prévisualisation (Mode Multiple - Contrats) */}
      {multiple && urls.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {urls.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted shadow-sm group">
              <Image src={url} alt="Doc" fill className="object-cover" unoptimized />
              <button 
                type="button" 
                onClick={() => removeImage(url)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {uploading && (
            <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      {/* Contrôles de saisie */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all font-bold text-sm shadow-md active:scale-95 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Choisir dans la galerie
          </button>
          
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ou collez le lien ici..."
              value={!multiple ? (urls[0] || '') : ''}
              onChange={(e) => !multiple && onChange(e.target.value)}
              className="pl-9 h-11 rounded-xl border-muted-foreground/20 focus:border-primary transition-all"
            />
          </div>
        </div>
        
        <p className="text-[10px] text-muted-foreground italic px-1 text-center">
          Note : Le bouton Galerie colle automatiquement l'URL si votre Firebase est configuré.
        </p>
      </div>

      {/* Input de fichier caché */}
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
