
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
import { User, CreditCard, Mail, Phone, MapPin, FileText } from "lucide-react";
import { Separator } from "../ui/separator";
import { ImageUpload } from "../image-upload";


const clientFormSchema = z.object({
  nom: z.string().min(2, "Le nom doit comporter au moins 2 caractères."),
  cin: z.string().min(5, "La CIN semble trop courte."),
  email: z.string().email("Veuillez entrer une adresse e-mail valide.").or(z.literal('')).optional(),
  permisNo: z.string().min(5, "Le numéro de permis semble trop court.").optional().nullable(),
  permisDateDelivrance: z.coerce.date().optional().nullable(),
  telephone: z.string().min(10, "Le numéro de téléphone semble incorrect."),
  adresse: z.string().min(10, "L'adresse est trop courte."),
  photoCIN: z.string().optional().or(z.literal('')),
  otherPhotos: z.array(z.string()).optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

const getSafeDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date.toDate) return date.toDate();
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
    otherPhotos: client.otherPhotos || [],
    email: client.email || "",
  } : {
    nom: "",
    cin: "",
    email: "",
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

        const clientPayload = {
          ...data,
          createdAt: client?.createdAt || serverTimestamp(),
          photoCIN: data.photoCIN || '',
          otherPhotos: data.otherPhotos || [],
          permisDateDelivrance: data.permisDateDelivrance ?? null,
          permisNo: data.permisNo ?? null,
          email: data.email || null,
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
            description: "Impossible d'enregistrer les informations du client. Vérifiez vos permissions.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4 pb-10">
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <User className="h-4 w-4" />
            <span>Informations Personnelles</span>
          </div>
          
          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom complet</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Ahmed Alami" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> CIN / Passeport
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="AB123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Adresse E-mail
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="exemple@mail.com" type="email" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <FileText className="h-4 w-4" />
            <span>Permis de Conduire</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="permisNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>N° de Permis</FormLabel>
                  <FormControl>
                    <Input placeholder="12/345678" {...field} value={field.value ?? ''} />
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
                  <FormLabel>Délivré le</FormLabel>
                  <FormControl>
                    <Input
                        type="date"
                        value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "yyyy-MM-dd") : ""}
                        onChange={(e) => {
                            const dateString = e.target.value;
                            field.onChange(dateString ? new Date(`${dateString}T00:00:00`) : null);
                        }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Phone className="h-4 w-4" />
            <span>Coordonnées</span>
          </div>
          <FormField
            control={form.control}
            name="telephone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input placeholder="+212 6..." {...field} />
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
                <FormLabel className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Adresse de résidence
                </FormLabel>
                <FormControl>
                  <Textarea placeholder="Rue, Quartier, Ville..." {...field} className="min-h-[80px]" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <CreditCard className="h-4 w-4" />
            <span>Pièces Justificatives</span>
          </div>
          
          <FormField
            control={form.control}
            name="photoCIN"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Photo de la CIN (Recto/Verso)</FormLabel>
                <FormControl>
                  <ImageUpload 
                    value={field.value || ''} 
                    onChange={field.onChange} 
                    folder="clients/cin" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="otherPhotos"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Autres documents (Permis, Passeport...)</FormLabel>
                <FormControl>
                  <ImageUpload 
                    value={field.value || []} 
                    onChange={field.onChange} 
                    folder="clients/docs" 
                    multiple 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (client ? 'Mettre à jour le client' : 'Ajouter le client')}
        </Button>
      </form>
    </Form>
  );
}
