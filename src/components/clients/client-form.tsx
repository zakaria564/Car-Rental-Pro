"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/lib/definitions";
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { format } from "date-fns";
import React from "react";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";


const clientFormSchema = z.object({
  nom: z.string().min(2, "Le nom doit comporter au moins 2 caractères."),
  cin: z.string().min(5, "La CIN semble trop courte."),
  permisNo: z.string().min(5, "Le numéro de permis semble trop court.").optional().nullable(),
  permisDateDelivrance: z.coerce.date().optional().nullable(),
  telephone: z.string().min(10, "Le numéro de téléphone semble incorrect."),
  adresse: z.string().min(10, "L'adresse est trop courte."),
  photoCIN: z.string().url("Veuillez entrer une URL valide.").or(z.literal('')).optional(),
  otherPhotos: z.array(z.object({ url: z.string().url("URL invalide.").or(z.literal('')) })).optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

const getSafeDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date.toDate) return date.toDate(); // Firestore Timestamp
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
};

export default function ClientForm({ client, onFinished }: { client: Client | null, onFinished: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const defaultValues: Partial<ClientFormValues> = client ? {
    ...client,
    permisDateDelivrance: getSafeDate(client.permisDateDelivrance),
    photoCIN: client.photoCIN || "",
    otherPhotos: client.otherPhotos ? client.otherPhotos.map(url => ({ url })) : [],
  } : {
    nom: "",
    cin: "",
    permisNo: "",
    permisDateDelivrance: null,
    telephone: "",
    adresse: "",
    photoCIN: "",
    otherPhotos: [],
  };

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues,
    mode: "onChange",
  });
  
  const { control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "otherPhotos"
  });

  const onSubmit = async (data: ClientFormValues) => {
    if (!firestore) {
        toast({ variant: "destructive", title: "Erreur", description: "La base de données n'est pas disponible." });
        return;
    }

    setIsSubmitting(true);

    try {
        const clientId = client?.id || doc(collection(firestore, 'clients')).id;
        const isNewClient = !client;
        const clientRef = doc(firestore, 'clients', clientId);

        const { otherPhotos, ...clientData } = data;
        const photoUrls = otherPhotos ? otherPhotos.map(p => p.url).filter(Boolean) : [];

        const clientPayload = {
          ...clientData,
          createdAt: client?.createdAt || serverTimestamp(),
          otherPhotos: photoUrls,
          photoCIN: data.photoCIN || '',
        };

        await setDoc(clientRef, clientPayload, { merge: !isNewClient });

        toast({
          title: isNewClient ? "Client ajouté" : "Client mis à jour",
          description: "Les informations du client ont été sauvegardées avec succès.",
        });
        onFinished();
    } catch (serverError: any) {
        console.error("Erreur de sauvegarde du client:", serverError);
        
        const permissionError = new FirestorePermissionError({
            path: `clients/${client?.id || 'new'}`,
            operation: client ? 'update' : 'create',
            requestResourceData: data
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);

        toast({
            variant: "destructive",
            title: "Erreur de sauvegarde",
            description: "Impossible d'enregistrer les informations du client. " + (serverError.message || "Veuillez vérifier votre connexion et vos permissions."),
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-4">
        <FormField
          control={form.control}
          name="nom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom complet</FormLabel>
              <FormControl>
                <Input placeholder="Jean Dupont" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carte d'identité nationale (CIN)</FormLabel>
              <FormControl>
                <Input placeholder="AB123456" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="permisNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numéro de permis de conduire</FormLabel>
              <FormControl>
                <Input placeholder="CD789123" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="permisDateDelivrance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de délivrance du permis</FormLabel>
              <FormControl>
                 <Input
                    type="date"
                    value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                    onChange={(e) => field.onChange(e.target.valueAsDate)}
                    />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="telephone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numéro de téléphone</FormLabel>
              <FormControl>
                <Input placeholder="+33 6 12 34 56 78" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="adresse"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse</FormLabel>
              <FormControl>
                <Textarea placeholder="123 Rue Principale, Anytown, France" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="photoCIN"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo de la CIN (URL)</FormLabel>
              {field.value && field.value.startsWith('http') ? (
                <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden border bg-muted my-2">
                    <Image 
                        src={field.value} 
                        alt={`CIN de ${form.getValues('nom')}`} 
                        fill 
                        className="object-contain"
                        data-ai-hint="id card"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </div>
              ) : null}
              <FormControl>
                <Input placeholder="https://exemple.com/image.jpg" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormDescription>
                Collez l'URL de l'image de la carte d'identité.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />


        <FormItem>
          <FormLabel>Autres Photos</FormLabel>
          <div className="space-y-2">
            {fields.map((item, index) => (
              <FormField
                key={item.id}
                control={control}
                name={`otherPhotos.${index}.url`}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://exemple.com/photo.jpg"
                          className="h-9"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Supprimer l'URL"
                        className="h-9 w-9 shrink-0 text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => append({ url: '' })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une URL de photo
            </Button>
          </div>
          <FormDescription>
            Ajoutez des URLs pour d'autres photos pertinentes (ex: permis, passeport).
          </FormDescription>
        </FormItem>

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (client ? 'Mettre à jour le client' : 'Ajouter un client')}
        </Button>
      </form>
    </Form>
  );
}
