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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Car } from "@/lib/definitions";
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import React from "react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { carBrands, type CarBrand } from "@/lib/car-data";
import { getSafeDate } from "@/lib/utils";
import { ImageUpload } from "../image-upload";

const carFormSchema = z.object({
  id: z.string().optional(),
  marque: z.string({ required_error: "La marque est requise."}).min(1, "La marque est requise."),
  modele: z.string({ required_error: "Le modèle est requis."}).min(1, "Le modèle est requis."),
  dateMiseEnCirculation: z.coerce.date({
    required_error: "La date de mise en circulation est requise.",
  }),
  immat: z.string().min(5, "La plaque d'immatriculation semble trop courte."),
  immatWW: z.string().optional().nullable(),
  numChassis: z.string().min(17, "Le numéro de châssis doit comporter 17 caractères.").max(17, "Le numéro de châssis doit comporter 17 caractères."),
  kilometrage: z.coerce.number().int("Le kilométrage doit être un nombre entier.").min(0, "Le kilométrage ne peut être négatif."),
  couleur: z.string().min(3, "La couleur est requise."),
  nbrPlaces: z.coerce.number().int("Le nombre de places doit être un nombre entier.").min(2, "Le nombre de places est requis.").max(9),
  puissance: z.coerce.number().int("La puissance doit être un nombre entier.").min(4, "La puissance est requise."),
  carburantType: z.enum(['Diesel', 'Essence', 'Electrique', 'Hybrid']),
  transmission: z.enum(['Manuelle', 'Automatique']),
  prixParJour: z.coerce.number().min(1, "Le prix doit être supérieur à 0."),
  etat: z.enum(["new", "good", "fair", "poor"]),
  photoURL: z.string().optional().or(z.literal('')),
  dateExpirationAssurance: z.coerce.date().optional().nullable(),
  dateProchaineVisiteTechnique: z.coerce.date().optional().nullable(),
  anneeVignette: z.coerce.number().optional().nullable(),
  maintenanceSchedule: z.object({
    prochainVidangeKm: z.coerce.number().optional().nullable(),
    prochainFiltreGasoilKm: z.coerce.number().optional().nullable(),
    prochainesPlaquettesFreinKm: z.coerce.number().optional().nullable(),
    prochaineCourroieDistributionKm: z.coerce.number().optional().nullable(),
  }).optional().nullable(),
});

type CarFormValues = z.infer<typeof carFormSchema>;

export default function CarForm({ car, onFinished }: { car: Car | null, onFinished: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const isNewCar = !car;

  const defaultValues = React.useMemo(() => {
    if (car) {
      return {
        ...car,
        dateMiseEnCirculation: getSafeDate(car.dateMiseEnCirculation) ?? undefined,
        dateExpirationAssurance: getSafeDate(car.dateExpirationAssurance) ?? undefined,
        dateProchaineVisiteTechnique: getSafeDate(car.dateProchaineVisiteTechnique) ?? undefined,
        anneeVignette: car.anneeVignette ?? undefined,
        immatWW: car.immatWW ?? undefined,
        maintenanceSchedule: car.maintenanceSchedule ? {
          prochainVidangeKm: car.maintenanceSchedule.prochainVidangeKm ?? undefined,
          prochainFiltreGasoilKm: car.maintenanceSchedule.prochainFiltreGasoilKm ?? undefined,
          prochainesPlaquettesFreinKm: car.maintenanceSchedule.prochainesPlaquettesFreinKm ?? undefined,
          prochaineCourroieDistributionKm: car.maintenanceSchedule.prochaineCourroieDistributionKm ?? undefined,
        } : {
          prochainVidangeKm: undefined,
          prochainFiltreGasoilKm: undefined,
          prochainesPlaquettesFreinKm: undefined,
          prochaineCourroieDistributionKm: undefined,
        }
      };
    }

    return {
      marque: "",
      modele: "",
      dateMiseEnCirculation: undefined as any,
      immat: "",
      immatWW: "",
      numChassis: "",
      kilometrage: undefined as any,
      couleur: "",
      nbrPlaces: 4,
      puissance: 7,
      carburantType: "Essence" as const,
      transmission: "Manuelle" as const,
      prixParJour: 250,
      etat: "new" as const,
      photoURL: "",
      dateExpirationAssurance: undefined as any,
      dateProchaineVisiteTechnique: undefined as any,
      anneeVignette: new Date().getFullYear(),
      maintenanceSchedule: {
        prochainVidangeKm: undefined,
        prochainFiltreGasoilKm: undefined,
        prochainesPlaquettesFreinKm: undefined,
        prochaineCourroieDistributionKm: undefined,
      }
    };
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

    const { id, ...carDataForFirestore } = data;
    
    const cleanedData: {[key: string]: any} = { ...carDataForFirestore };
    for (const key in cleanedData) {
      if (cleanedData[key] === undefined) {
        cleanedData[key] = null;
      }
    }
    
    const carPayload = {
      ...cleanedData,
      createdAt: car?.createdAt || serverTimestamp(),
      photoURL: cleanedData.photoURL || "",
      disponibilite: car?.disponibilite || 'disponible',
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
          description: "Impossible de sauvegarder la voiture. Vérifiez vos permissions.",
        });
      }).finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4 pb-10">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Informations Générales</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="photoURL"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Photo du véhicule</FormLabel>
                          <FormControl>
                            <ImageUpload 
                              value={field.value || ''} 
                              onChange={field.onChange} 
                              folder="cars" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                              value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "yyyy-MM-dd") : ""}
                              onChange={(e) => {
                                const dateString = e.target.value;
                                field.onChange(dateString ? new Date(dateString) : undefined);
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
                            <Input placeholder="12345 - أ - 1" {...field} />
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
                        <FormLabel>Numéro de châssis (VIN)</FormLabel>
                        <FormControl>
                            <Input placeholder="17 caractères" {...field} />
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
                              <Input 
                                  type="number" 
                                  placeholder="0"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                              />
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
                                <Input type="number" placeholder="8" {...field} value={field.value ?? ''} />
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
                            <SelectItem value="Hybrid">Hybride</SelectItem>
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
                            <Input type="number" placeholder="250" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-2">
                <AccordionTrigger>Documents & Rappels</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                     <FormField
                        control={form.control}
                        name="dateExpirationAssurance"
                        render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration Assurance</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "yyyy-MM-dd") : ""}
                                  onChange={(e) => {
                                    const dateString = e.target.value;
                                    field.onChange(dateString ? new Date(dateString) : undefined);
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
                                  <FormLabel>Prochaine Visite Technique</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "yyyy-MM-dd") : ""}
                                      onChange={(e) => {
                                        const dateString = e.target.value;
                                        field.onChange(dateString ? new Date(dateString) : undefined);
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
                </AccordionContent>
            </AccordionItem>
        </Accordion>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (car ? 'Mettre à jour' : 'Ajouter le véhicule')}
        </Button>
      </form>
    </Form>
  );
}
