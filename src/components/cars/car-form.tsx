
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
import { useToast } from "@/hooks/use-toast";
import type { Car } from "@/lib/definitions";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/firebase";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const carFormSchema = z.object({
  marque: z.string().min(2, "La marque doit comporter au moins 2 caractères."),
  modele: z.string().min(1, "Le modèle est requis."),
  modeleAnnee: z.coerce.number().min(1990, "L'année doit être supérieure à 1990.").max(new Date().getFullYear() + 1),
  immat: z.string().min(5, "La plaque d'immatriculation semble trop courte."),
  kilometrage: z.coerce.number().min(0, "Le kilométrage ne peut être négatif."),
  couleur: z.string().min(3, "La couleur est requise."),
  nbrPlaces: z.coerce.number().min(2, "Le nombre de places est requis.").max(9),
  puissance: z.coerce.number().min(4, "La puissance est requise."),
  carburantType: z.enum(['Diesel', 'Essence', 'Electrique']),
  prixParJour: z.coerce.number().min(1, "Le prix doit être supérieur à 0."),
  etat: z.enum(["new", "good", "fair", "poor"]),
  disponible: z.boolean().default(true),
  photo: z.instanceof(FileList).optional(),
});

type CarFormValues = z.infer<typeof carFormSchema>;

export default function CarForm({ car, onFinished }: { car: Car | null, onFinished: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, storage } = useFirebase();

  const defaultValues: Partial<CarFormValues> = car ? {
    ...car,
    photo: undefined,
  } : {
    marque: "",
    modele: "",
    modeleAnnee: undefined,
    immat: "",
    kilometrage: undefined,
    couleur: "",
    nbrPlaces: 5,
    puissance: 7,
    carburantType: "Essence",
    prixParJour: undefined,
    etat: "new",
    disponible: true,
    photo: undefined,
  };

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
    defaultValues,
    mode: "onChange",
  });
  
  const photoRef = form.register("photo");

  async function onSubmit(data: CarFormValues) {
    if (!firestore || !storage) return;

    const { photo, ...carData } = data;
    const carId = car?.id || doc(collection(firestore, 'cars')).id;
    
    let photoURL = car?.photoURL;
    const photoFile = data.photo?.[0];

    const carPayload = {
      ...carData,
      createdAt: car?.createdAt || serverTimestamp(),
    };

    const saveCar = (finalPhotoUrl: string) => {
        const payloadWithImage = { ...carPayload, photoURL: finalPhotoUrl };
        const carRef = doc(firestore, 'cars', carId);
        
        const operation = car ? setDoc(carRef, payloadWithImage, { merge: true }) : setDoc(carRef, payloadWithImage);

        operation.then(() => {
            toast({
                title: car ? "Voiture mise à jour" : "Voiture ajoutée",
                description: car ? "Les informations ont été mises à jour." : "La nouvelle voiture a été ajoutée.",
            });
            onFinished();
            router.refresh();
        }).catch(error => {
             console.error("Erreur lors de la sauvegarde de la voiture:", error);
             const permissionError = new FirestorePermissionError({
                path: carRef.path,
                operation: car ? 'update' : 'create',
                requestResourceData: payloadWithImage
            }, error);
            errorEmitter.emit('permission-error', permissionError);

            toast({
                variant: "destructive",
                title: "Une erreur est survenue",
                description: error.message || "Impossible de sauvegarder la voiture.",
            });
        });
    }

    if (photoFile) {
        toast({ title: "Téléversement de l'image..." });
        const storageRef = ref(storage, `cars/${carId}/${photoFile.name}`);
        uploadBytes(storageRef, photoFile)
            .then(uploadResult => getDownloadURL(uploadResult.ref))
            .then(url => {
                toast({ title: "Image téléversée !" });
                saveCar(url);
            })
            .catch(error => {
                console.error("Erreur de téléversement:", error);
                toast({
                    variant: "destructive",
                    title: "Erreur de téléversement",
                    description: "Impossible de téléverser l'image.",
                });
                // Even if upload fails, we don't want to leave the form submitting forever
                form.reset(data); // Resets form state
            });
    } else {
        const finalPhotoUrl = photoURL || `https://picsum.photos/seed/${carId}/600/400`;
        saveCar(finalPhotoUrl);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
          name="modeleAnnee"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Année</FormLabel>
              <FormControl>
                <Input type="number" placeholder="2023" {...field} value={field.value ?? ''} />
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
          name="kilometrage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kilométrage</FormLabel>
              <FormControl>
                <Input type="number" placeholder="54000" {...field} value={field.value ?? ''}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="couleur"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Couleur</FormLabel>
              <FormControl>
                <Input placeholder="Noir" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="nbrPlaces"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Places</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="5" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="puissance"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Puissance (cv)</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="8" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <FormField
          control={form.control}
          name="carburantType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carburant</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Type de carburant" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Essence">Essence</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Electrique">Électrique</SelectItem>
                </SelectContent>
              </Select>
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
                <Input
                  type="number"
                  placeholder="99.99"
                  {...field}
                  value={field.value ?? ''}
                />
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
                        <Input type="file" accept="image/*" {...photoRef} />
                    </FormControl>
                     <FormDescription>
                        {car ? "Laissez vide pour conserver l'image actuelle." : "Si aucune image n'est choisie, une image par défaut sera utilisée."}
                    </FormDescription>
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

    