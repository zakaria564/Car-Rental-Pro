
"use client";

import { useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Car } from "@/lib/definitions";
import { FileInput } from "../ui/file-input";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const carFormSchema = z.object({
  marque: z.string().min(2, "La marque doit comporter au moins 2 caractères."),
  modele: z.string().min(1, "Le modèle est requis."),
  immat: z.string().min(5, "La plaque d'immatriculation semble trop courte."),
  prixParJour: z.coerce.number().min(1, "Le prix doit être supérieur à 0."),
  etat: z.enum(["new", "good", "fair", "poor"]),
  disponible: z.boolean().default(true),
  photo: z.any().optional(),
});

type CarFormValues = z.infer<typeof carFormSchema>;

export default function CarForm({ car, onFinished }: { car: Car | null, onFinished: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const defaultValues: Partial<CarFormValues> = car ? {
    ...car,
  } : {
    marque: "",
    modele: "",
    immat: "",
    prixParJour: 0,
    etat: "new",
    disponible: true,
    photo: undefined,
  };

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
    defaultValues,
    mode: "onChange",
  });

  async function onSubmit(data: CarFormValues) {
    const { photo, ...carData } = data;
    
    const carPayload = {
      ...carData,
      photoURL: "https://picsum.photos/seed/car-default/600/400",
      createdAt: serverTimestamp(),
      modeleAnnee: new Date().getFullYear(),
      couleur: 'Inconnue',
      nbrPlaces: 5,
      puissance: 7,
      carburantType: 'Essence',
    };

    const carsCollection = collection(firestore, 'cars');

    addDoc(carsCollection, carPayload).catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: carsCollection.path,
          operation: 'create',
          requestResourceData: carPayload
      }, serverError);
      errorEmitter.emit('permission-error', permissionError);
    });

    toast({
      title: car ? "Voiture mise à jour" : "Voiture ajoutée",
      description: "L'opération a été initiée.",
    });

    onFinished();
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-4">
        <FormField
          control={form.control}
          name="marque"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marque</FormLabel>
              <FormControl>
                <Input placeholder="Tesla" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="modele"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modèle</FormLabel>
              <FormControl>
                <Input placeholder="Model S" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="immat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plaque d'immatriculation</FormLabel>
              <FormControl>
                <Input placeholder="VOITURE-123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="prixParJour"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prix par jour (MAD)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="99.99" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="etat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>État</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez l'état de la voiture" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="new">Neuf</SelectItem>
                  <SelectItem value="good">Bon</SelectItem>
                  <SelectItem value="fair">Passable</SelectItem>
                  <SelectItem value="poor">Mauvais</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="photo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <FormControl>
                 <FileInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Enregistrement...' : (car ? 'Mettre à jour la voiture' : 'Ajouter une voiture')}
        </Button>
      </form>
    </Form>
  );
}
