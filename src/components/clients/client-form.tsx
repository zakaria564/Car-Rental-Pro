
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/lib/definitions";
import { PhotoFormField } from "../ui/file-input";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { format } from "date-fns";
import React from "react";


const clientFormSchema = z.object({
  nom: z.string().min(2, "Le nom doit comporter au moins 2 caractères."),
  cin: z.string().min(5, "La CIN semble trop courte."),
  permisNo: z.string().min(5, "Le numéro de permis semble trop court.").optional().nullable(),
  permisDateDelivrance: z.coerce.date().optional().nullable(),
  telephone: z.string().min(10, "Le numéro de téléphone semble incorrect."),
  adresse: z.string().min(10, "L'adresse est trop courte."),
  photoCIN: z.any().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

const getSafeDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date.toDate) return date.toDate(); // Firestore Timestamp
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
};

export default function ClientForm({ client, onFinished }: { client: Client | null, onFinished: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, storage } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const defaultValues: Partial<ClientFormValues> = client ? {
    ...client,
    permisDateDelivrance: getSafeDate(client.permisDateDelivrance),
  } : {
    nom: "",
    cin: "",
    permisNo: "",
    permisDateDelivrance: null,
    telephone: "",
    adresse: "",
    photoCIN: undefined,
  };

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues,
    mode: "onChange",
  });
  
  const photoCINRef = form.register("photoCIN");

  async function onSubmit(data: ClientFormValues) {
    setIsSubmitting(true);
    const { photoCIN, ...clientDataWithoutPhoto } = data;

    const clientId = client?.id || doc(collection(firestore, 'clients')).id;
    const isNewClient = !client;

    let finalPhotoUrl = client?.photoCIN;

    if (!finalPhotoUrl && isNewClient) {
        finalPhotoUrl = `https://picsum.photos/seed/${clientId}/400/250`;
    }

    if (photoCIN && photoCIN.length > 0 && photoCIN[0] instanceof File) {
        const file = photoCIN[0];
        const storageRef = ref(storage, `clients/${clientId}/cin_${Date.now()}_${file.name}`);
        
        try {
            const uploadResult = await uploadBytes(storageRef, file);
            finalPhotoUrl = await getDownloadURL(uploadResult.ref);
        } catch (e) {
            console.error(e);
            toast({
              variant: "destructive",
              title: "Erreur de téléversement",
              description: "Impossible d'enregistrer l'image. Veuillez réessayer.",
            });
            setIsSubmitting(false);
            return;
        }
    }

    const clientPayload = {
      ...clientDataWithoutPhoto,
      photoCIN: finalPhotoUrl,
      ...(isNewClient ? { createdAt: serverTimestamp() } : { createdAt: client.createdAt }),
    };

    const clientRef = doc(firestore, 'clients', clientId);

    setDoc(clientRef, clientPayload, { merge: !isNewClient })
      .then(() => {
        toast({
          title: isNewClient ? "Client ajouté" : "Client mis à jour",
          description: "Les informations du client ont été sauvegardées avec succès.",
        });
        onFinished();
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: clientRef.path,
            operation: isNewClient ? 'create' : 'update',
            requestResourceData: clientPayload
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erreur de sauvegarde",
            description: "Impossible d'enregistrer les informations du client."
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

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
                  value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                  onChange={(e) => field.onChange(e.target.value ? e.target.valueAsDate : null)}
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
        <FormItem>
          <FormLabel>Photo de la CIN</FormLabel>
          <FormControl>
             <PhotoFormField {...photoCINRef} />
          </FormControl>
          <FormMessage />
        </FormItem>
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (client ? 'Mettre à jour le client' : 'Ajouter un client')}
        </Button>
      </form>
    </Form>
  );
}

