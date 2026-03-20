'use client';

import React, { useRef, useState } from 'react';
import { Image as ImageIcon, X, Upload, Link as LinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  folder: string;
  multiple?: boolean;
}

export function ImageUpload({ value, onChange, folder, multiple = false }: ImageUploadProps) {
  const { storage } = useFirebase();
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Si le storage n'est pas configuré, on bascule en mode URL
    if (!storage || !storage.app.options.storageBucket || storage.app.options.storageBucket.includes("YOUR_STORAGE_BUCKET")) {
      setShowUrlInput(true);
      return;
    }

    setUploading(true);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `${folder}/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      null,
      (error) => {
        console.error('Upload error:', error);
        setUploading(false);
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
      }
    );
  };

  const removeImage = (urlToRemove: string) => {
    if (multiple) {
      onChange(urls.filter(u => u !== urlToRemove));
    } else {
      onChange('');
    }
  };

  return (
    <div className="space-y-2">
      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "relative aspect-video w-full rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all overflow-hidden shadow-sm",
          urls[0] && !multiple && "border-none bg-black"
        )}
      >
        {urls[0] && !multiple ? (
          <>
            <Image src={urls[0]} alt="Preview" fill className="object-contain" unoptimized />
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); removeImage(urls[0]); }}
              className="absolute top-2 right-2 bg-destructive text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform z-10"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Envoi...</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 opacity-30" />
                <span className="text-xs font-medium">Cliquer pour choisir dans la galerie</span>
              </>
            )}
          </div>
        )}
      </div>

      {multiple && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {urls.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted shadow-inner">
              <Image src={url} alt="Doc" fill className="object-cover" unoptimized />
              <button 
                type="button" 
                onClick={() => removeImage(url)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md shadow hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      <div className="pt-1">
        <button 
          type="button" 
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-1"
        >
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Masquer le mode manuel" : "Problème ? Mode Manuel (URL)"}
        </button>

        {showUrlInput && (
          <div className="mt-2 space-y-2">
            <Input 
              placeholder="Coller le lien de l'image ici..." 
              value={multiple ? "" : (typeof value === 'string' ? value : '')} 
              onChange={(e) => !multiple && onChange(e.target.value)}
              className="h-9 text-xs rounded-lg border-primary/20 focus:border-primary"
            />
            {multiple && (
               <button 
                type="button"
                onClick={() => {
                  const url = prompt("Collez l'URL de l'image :");
                  if (url) onChange([...urls, url]);
                }}
                className="w-full h-9 border-2 border-dashed rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/50"
               >
                 + Ajouter un lien d'image
               </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
