'use client';

import React from 'react';
import { Link as LinkIcon, Image as ImageIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  folder?: string;
  multiple?: boolean;
}

/**
 * Composant ultra-simplifié pour gérer les images via URL uniquement.
 * Élimine tout risque de blocage lié au stockage Firebase.
 */
export function ImageUpload({ value, onChange, multiple = false }: ImageUploadProps) {
  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  const handleAddUrl = () => {
    const url = prompt("Veuillez coller l'URL directe de l'image (ex: https://...) :");
    if (url && url.trim()) {
      if (multiple) {
        onChange([...urls, url.trim()]);
      } else {
        onChange(url.trim());
      }
    }
  };

  const removeImage = (urlToRemove: string) => {
    if (multiple) {
      onChange(urls.filter(u => u !== urlToRemove));
    } else {
      onChange('');
    }
  };

  const updateSingleUrl = (newUrl: string) => {
    onChange(newUrl.trim());
  };

  return (
    <div className="space-y-3">
      {/* Zone d'affichage / Preview */}
      {!multiple && (
        <div className={cn(
          "relative aspect-video w-full rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 flex flex-col items-center justify-center overflow-hidden transition-all",
          urls[0] && "border-none bg-black"
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
                className="absolute top-2 right-2 bg-destructive text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform z-10"
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
        </div>
      )}

      {/* Grille pour le mode multiple (Contrats) */}
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
        </div>
      )}

      {/* Contrôles de saisie */}
      <div className="space-y-2">
        {!multiple ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Coller le lien de l'image ici..." 
                value={urls[0] || ''} 
                onChange={(e) => updateSingleUrl(e.target.value)}
                className="pl-9 h-10 text-sm rounded-lg"
              />
            </div>
          </div>
        ) : (
          <button 
            type="button"
            onClick={handleAddUrl}
            className="w-full h-12 border-2 border-dashed border-primary/30 rounded-xl text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Ajouter un lien d'image
          </button>
        )}
        <p className="text-[10px] text-muted-foreground italic px-1">
          Astuce : Copiez le lien d'une image en ligne et collez-le ici.
        </p>
      </div>
    </div>
  );
}

// Helper pour le bouton d'ajout dans le mode multiple (import manquant sinon)
function PlusCircle({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
