
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
import { FileInput } from "../ui/file-input";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/firebase";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const clientFormSchema = z.object({
  nom: z.string().min(2, "Le nom doit comporter au moins 2 caractères."),
  cin: z.string().min(5, "La CIN semble trop courte."),
  telephone: z.string().min(10, "Le numéro de téléphone semble incorrect."),
  adresse: z.string().min(10, "L'adresse est trop courte."),
  photoCIN: z.any().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

export default function ClientForm({ client, onFinished }: { client: Client | null, onFinished: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  
  const defaultValues: Partial<ClientFormValues> = client ? {
    ...client,
  } : {
    nom: "",
    cin: "",
    telephone: "",
    adresse: "",
    photoCIN: undefined,
  };

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues,
    mode: "onChange",
  });

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
    router.refresh();
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
              <FormLabel>Photo de la CIN</FormLabel>
              <FormControl>
                <FileInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Enregistrement...' : (client ? 'Mettre à jour le client' : 'Ajouter un client')}
        </Button>
      </form>
    </Form>
  );
}
