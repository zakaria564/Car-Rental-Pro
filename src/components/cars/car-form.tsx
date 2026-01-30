
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
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import React from "react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Textarea } from "../ui/textarea";
import { carBrands, type CarBrand } from "@/lib/car-data";

const carFormSchema = z.object({
  marque: z.string({ required_error: "La marque est requise."}).min(1, "La marque est requise."),
  modele: z.string({ required_error: "Le modèle est requis."}).min(1, "Le modèle est requis."),
  dateMiseEnCirculation: z.coerce.date({
    required_error: "La date de mise en circulation est requise.",
  }),
  immat: z.string().min(5, "La plaque d'immatriculation semble trop courte."),
  numChassis: z.string().min(17, "Le numéro de châssis doit comporter 17 caractères.").max(17, "Le numéro de châssis doit comporter 17 caractères."),
  kilometrage: z.coerce.number().int("Le kilométrage doit être un nombre entier.").min(0, "Le kilométrage ne peut être négatif."),
  couleur: z.string().min(3, "La couleur est requise."),
  nbrPlaces: z.coerce.number().int("Le nombre de places doit être un nombre entier.").min(2, "Le nombre de places est requis.").max(9),
  puissance: z.coerce.number().int("La puissance doit être un nombre entier.").min(4, "La puissance est requise."),
  carburantType: z.enum(['Diesel', 'Essence', 'Electrique']),
  transmission: z.enum(['Manuelle', 'Automatique']),
  prixParJour: z.coerce.number().min(1, "Le prix doit être supérieur à 0."),
  etat: z.enum(["new", "good", "fair", "poor"]),
  disponible: z.boolean().default(true),
  photoURL: z.string().url("Veuillez entrer une URL valide.").optional().or(z.literal('')),
  dateExpirationAssurance: z.coerce.date().optional().nullable(),
  dateProchaineVisiteTechnique: z.coerce.date().optional().nullable(),
  anneeVignette: z.coerce.number().optional().nullable(),
  maintenanceHistory: z.string().optional().nullable(),
});

type CarFormValues = z.infer<typeof carFormSchema>;

const getSafeDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date && !isNaN(date.getTime())) return date;
    if (date.toDate) return date.toDate(); // Firestore Timestamp
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return undefined;
    // Adjust for timezone offset
    return new Date(parsedDate.valueOf() + parsedDate.getTimezoneOffset() * 60 * 1000);
};

export default function CarForm({ car, onFinished }: { car: Car | null, onFinished: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const defaultValues = React.useMemo(() => {
    return car ? {
      ...car,
      dateMiseEnCirculation: getSafeDate(car.dateMiseEnCirculation),
      dateExpirationAssurance: getSafeDate(car.dateExpirationAssurance),
      dateProchaineVisiteTechnique: getSafeDate(car.dateProchaineVisiteTechnique),
      anneeVignette: car.anneeVignette ?? undefined,
      maintenanceHistory: car.maintenanceHistory ?? ""
    } : {
      marque: "",
      modele: "",
      dateMiseEnCirculation: new Date(),
      immat: "",
      numChassis: "",
      kilometrage: 0,
      couleur: "",
      nbrPlaces: 4,
      puissance: 7,
      carburantType: "Essence" as const,
      transmission: "Manuelle" as const,
      prixParJour: 250,
      etat: "new" as const,
      disponible: true,
      photoURL: "",
      dateExpirationAssurance: null,
      dateProchaineVisiteTechnique: null,
      anneeVignette: new Date().getFullYear(),
      maintenanceHistory: "",
    }
  }, [car]);

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
    mode: "onChange",
    defaultValues,
  });
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const selectedMarque = form.watch("marque") as CarBrand;

  React.useEffect(() => {
    form.reset(defaultValues);
  }, [car, defaultValues, form]);


  const onSubmit = (data: CarFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);

    const carId = car?.id || doc(collection(firestore, 'cars')).id;
    const isNewCar = !car;

    const carPayload = {
      ...data,
      createdAt: car?.createdAt || serverTimestamp(),
      photoURL: data.photoURL || `https://picsum.photos/seed/${carId}/600/400`,
    };

    const carRef = doc(firestore, 'cars', carId);
    
    setDoc(carRef, carPayload, { merge: !isNewCar })
      .then(() => {
        toast({
          title: isNewCar ? "Voiture ajoutée" : "Voiture mise à jour",
          description: isNewCar ? "La nouvelle voiture a été ajoutée." : "Les informations ont été mises à jour.",
        });
        onFinished();
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: carRef.path,
          operation: isNewCar ? 'create' : 'update',
          requestResourceData: carPayload
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);

        toast({
          variant: "destructive",
          title: "Une erreur est survenue",
          description: "Impossible de sauvegarder la voiture. Vérifiez vos permissions et réessayez.",
        });
      }).finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Informations Générales</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="marque"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marque</FormLabel>
                          <Select onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue('modele', '');
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une marque" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.keys(carBrands).sort().map((brand) => (
                                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedMarque}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={!selectedMarque ? "Sélectionnez d'abord une marque" : "Sélectionner un modèle"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {selectedMarque && carBrands[selectedMarque] && carBrands[selectedMarque].map((model) => (
                                <SelectItem key={model} value={model}>{model}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateMiseEnCirculation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de mise en circulation</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                              onChange={(e) => {
                                const dateString = e.target.value;
                                if (!dateString) {
                                    field.onChange(null);
                                } else {
                                    field.onChange(new Date(`${dateString}T00:00:00`));
                                }
                              }}
                            />
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
                            <Input placeholder="12345 - أ - 1 | WW..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="numChassis"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Numéro de châssis</FormLabel>
                        <FormControl>
                            <Input placeholder="17 caractères alphanumériques" {...field} />
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
                            <Input type="number" placeholder="54000" {...field} />
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
                                <Input type="number" placeholder="5" {...field} />
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
                                <Input type="number" placeholder="8" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    name="transmission"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Transmission</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Type de transmission" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="Manuelle">Manuelle</SelectItem>
                            <SelectItem value="Automatique">Automatique</SelectItem>
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        name="photoURL"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Photo (URL)</FormLabel>
                                <FormControl>
                                    <Input type="text" placeholder="https://exemple.com/image.png" {...field} />
                                </FormControl>
                                <FormDescription>
                                    Collez l'URL de l'image ici. Si le champ est laissé vide, une image par défaut sera utilisée.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-2">
                <AccordionTrigger>Documents & Entretien</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                     <FormField
                        control={form.control}
                        name="dateExpirationAssurance"
                        render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date d'expiration de l'assurance</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                                  onChange={(e) => {
                                    const dateString = e.target.value;
                                    if (!dateString) {
                                        field.onChange(null);
                                    } else {
                                        field.onChange(new Date(`${dateString}T00:00:00`));
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                        )}
                        />
                         <FormField
                            control={form.control}
                            name="dateProchaineVisiteTechnique"
                            render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date de la prochaine visite technique</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                                      onChange={(e) => {
                                        const dateString = e.target.value;
                                        if (!dateString) {
                                            field.onChange(null);
                                        } else {
                                            field.onChange(new Date(`${dateString}T00:00:00`));
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="anneeVignette"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Année de la vignette</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder={new Date().getFullYear().toString()} {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maintenanceHistory"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Historique d'entretien</FormLabel>
                                 <FormControl>
                                    <Textarea
                                        placeholder="20/01/2024 - Vidange d'huile (50,000 km)&#10;15/03/2024 - Remplacement des plaquettes de frein avant"
                                        className="min-h-32"
                                        {...field}
                                        value={field.value ?? ''}
                                    />
                                </FormControl>
                                <FormDescription>
                                    Notez chaque intervention avec la date, la description, et le kilométrage.
                                </FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                </AccordionContent>
            </AccordionItem>
        </Accordion>

        
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (car ? 'Mettre à jour la voiture' : 'Ajouter une voiture')}
        </Button>
      </form>
    </Form>
  );
}
