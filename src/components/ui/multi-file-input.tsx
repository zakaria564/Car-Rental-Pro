
"use client";

import * as React from "react";
import Image from "next/image";
import { UploadCloud, X } from "lucide-react";
import { useFormContext, useController } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "./button";


type FileWithPreview = File & { preview: string };

const MultiPhotoFormField = React.forwardRef<
    HTMLInputElement,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "name"> & {name: string}
>(({ name, className, ...props }, ref) => {
    
    const { control, getValues, setValue } = useFormContext();
    const { field } = useController({ name, control });

    const [previews, setPreviews] = React.useState<FileWithPreview[]>(getValues(name) || []);

    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      return () => {
        previews.forEach(file => URL.revokeObjectURL(file.preview));
      };
    }, [previews]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => Object.assign(file, {
                preview: URL.createObjectURL(file)
            }));
            const updatedFiles = [...(previews || []), ...newFiles];
            setPreviews(updatedFiles);
            setValue(name, updatedFiles, { shouldValidate: true, shouldDirty: true });
        }
        if (e.target) {
            e.target.value = "";
        }
    };

    const removeFile = (indexToRemove: number) => {
        const updatedFiles = previews.filter((_, index) => index !== indexToRemove);
        URL.revokeObjectURL(previews[indexToRemove].preview); // Clean up
        setPreviews(updatedFiles);
        setValue(name, updatedFiles, { shouldValidate: true, shouldDirty: true });
    };

    return (
        <div className="space-y-4">
             <div 
                className={cn("relative flex justify-center w-full h-32 px-4 transition bg-background border-2 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none", className)}
                onClick={() => inputRef.current?.click()}
            >
                <div className="flex items-center space-x-2">
                    <UploadCloud className="w-10 h-10 text-muted-foreground" />
                    <div className="text-muted-foreground">
                        <span className="font-medium text-primary">Cliquez pour ajouter</span> ou glissez-déposez.
                    </div>
                </div>
                 <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    ref={inputRef}
                    {...props}
                />
            </div>
            {previews && previews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {previews.map((file, index) => (
                        <div key={file.name + index} className="relative group aspect-square">
                           <Image src={file.preview} alt={file.name} fill className="object-cover rounded-md" />
                            <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(index);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
MultiPhotoFormField.displayName = "MultiPhotoFormField";

const ExistingPhotoViewer = ({ urls }: { urls: string[] | undefined }) => {
    if (!urls || urls.length === 0) return (
         <p className="text-sm text-muted-foreground">Aucune photo enregistrée.</p>
    );
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Photos existantes :</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {urls.map((url, index) => (
                    <a key={url + index} href={url} target="_blank" rel="noopener noreferrer" className="relative group aspect-square">
                        <Image src={url} alt={`Photo existante ${index + 1}`} fill className="object-cover rounded-md" />
                    </a>
                ))}
            </div>
        </div>
    );
};


export { MultiPhotoFormField, ExistingPhotoViewer };

    