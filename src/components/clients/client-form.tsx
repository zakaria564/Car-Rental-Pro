
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
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import React from "react";


const clientFormSchema = z.object({
  nom: z.string().min(2, "Le nom doit comporter au moins 2 caractères."),
  cin: z.string().min(5, "La CIN semble trop courte."),
  permisNo: z.string().min(5, "Le numéro de permis semble trop court."),
  permisDateDelivrance: z.date().optional().nullable(),
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
  const { firestore } = useFirebase();
  
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
    const { photoCIN, ...clientData } = data;
    
    const clientPayload = {
      ...clientData,
      photoCIN: "https://picsum.photos/seed/cin-default/400/250",
      createdAt: serverTimestamp(),
    };

    if (client) {
      const clientRef = doc(firestore, 'clients', client.id);
      setDoc(clientRef, clientPayload, { merge: true }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: clientRef.path,
            operation: 'update',
            requestResourceData: clientPayload
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
      });
       toast({
        title: "Client mis à jour",
        description: "L'opération a été initiée.",
      });
    } else {
      const clientsCollection = collection(firestore, 'clients');
      addDoc(clientsCollection, clientPayload).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: clientsCollection.path,
            operation: 'create',
            requestResourceData: clientPayload
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
      });
       toast({
        title: "Client ajouté",
        description: "L'opération a été initiée.",
      });
    }

    onFinished();
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
                <Input placeholder="CD789123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="permisDateDelivrance"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date de délivrance du permis</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    locale={fr}
                    captionLayout="dropdown-nav"
                    fromYear={1960}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
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
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Enregistrement...' : (client ? 'Mettre à jour le client' : 'Ajouter un client')}
        </Button>
      </form>
    </Form>
  );
}
