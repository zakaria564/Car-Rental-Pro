
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
import { Textarea } from "../ui/textarea";
import { carBrands, maintenanceInterventionTypes, type CarBrand } from "@/lib/car-data";
import { PlusCircle, Trash2 } from "lucide-react";
import { cn, getSafeDate } from "@/lib/utils";

const maintenanceEventSchema = z.object({
  date: z.coerce.date({ required_error: "La date est requise." }),
  kilometrage: z.coerce.number().int().min(0, "Le kilométrage ne peut être négatif."),
  typeIntervention: z.string().min(3, "Le type d'intervention est requis."),
  description: z.string().min(5, "La description est requise."),
  cout: z.coerce.number().min(0).optional().nullable(),
});

const carFormSchema = z.object({
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
  photoURL: z.string().url("Veuillez entrer une URL valide.").optional().or(z.literal('')),
  dateExpirationAssurance: z.coerce.date().optional().nullable(),
  dateProchaineVisiteTechnique: z.coerce.date().optional().nullable(),
  anneeVignette: z.coerce.number().optional().nullable(),
  maintenanceHistory: z.array(maintenanceEventSchema).optional().nullable(),
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

  const isMaintenance = car?.disponibilite === 'maintenance';

  const defaultValues = React.useMemo(() => {
    const maintenanceHistory = (car?.maintenanceHistory && Array.isArray(car.maintenanceHistory))
        ? car.maintenanceHistory.map(event => ({
            ...event,
            date: getSafeDate(event.date) || new Date(),
        }))
        : [];

    return car ? {
      ...car,
      dateMiseEnCirculation: getSafeDate(car.dateMiseEnCirculation),
      dateExpirationAssurance: getSafeDate(car.dateExpirationAssurance),
      dateProchaineVisiteTechnique: getSafeDate(car.dateProchaineVisiteTechnique),
      anneeVignette: car.anneeVignette ?? undefined,
      maintenanceHistory,
      immatWW: car.immatWW ?? "",
      maintenanceSchedule: car.maintenanceSchedule ? {
        ...car.maintenanceSchedule
      } : {
        prochainVidangeKm: undefined,
        prochainFiltreGasoilKm: undefined,
        prochainesPlaquettesFreinKm: undefined,
        prochaineCourroieDistributionKm: undefined,
      }
    } : {
      marque: "",
      modele: "",
      dateMiseEnCirculation: undefined,
      immat: "",
      immatWW: "",
      numChassis: "",
      kilometrage: undefined,
      couleur: "",
      nbrPlaces: 4,
      puissance: 7,
      carburantType: "Essence" as const,
      transmission: "Manuelle" as const,
      prixParJour: 250,
      etat: "new" as const,
      photoURL: "",
      dateExpirationAssurance: null,
      dateProchaineVisiteTechnique: null,
      anneeVignette: new Date().getFullYear(),
      maintenanceHistory: [],
      maintenanceSchedule: {
        prochainVidangeKm: undefined,
        prochainFiltreGasoilKm: undefined,
        prochainesPlaquettesFreinKm: undefined,
        prochaineCourroieDistributionKm: undefined,
      }
    }
  }, [car]);

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
    mode: "onChange",
    defaultValues,
  });
  
  const { getValues } = form;
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const selectedMarque = form.watch("marque") as CarBrand;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "maintenanceHistory",
  });
  
  React.useEffect(() => {
    form.reset(defaultValues);
  }, [car, defaultValues, form]);


  const onSubmit = (data: CarFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);

    const carId = car?.id || doc(collection(firestore, 'cars')).id;
    const isNewCar = !car;

    const carDataForFirestore: { [key: string]: any } = { ...data };

    if (carDataForFirestore.maintenanceSchedule) {
      Object.keys(carDataForFirestore.maintenanceSchedule).forEach((key) => {
        const typedKey = key as keyof typeof carDataForFirestore.maintenanceSchedule;
        if (carDataForFirestore.maintenanceSchedule[typedKey] === undefined || carDataForFirestore.maintenanceSchedule[typedKey] === '') {
          carDataForFirestore.maintenanceSchedule[typedKey] = null;
        }
      });
    }

    for (const key in carDataForFirestore) {
      if (carDataForFirestore[key] === undefined) {
        carDataForFirestore[key] = null;
      }
    }
    
    const carPayload = {
      ...carDataForFirestore,
      createdAt: car?.createdAt || serverTimestamp(),
      photoURL: carDataForFirestore.photoURL || `https://picsum.photos/seed/${carId}/600/400`,
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
        console.error("Firestore Error:", serverError.message);
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
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
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
                                    field.onChange(new Date(dateString));
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
                        <FormLabel>Plaque d'immatriculation (12345 - أ - 1)</FormLabel>
                        <FormControl>
                            <Input placeholder="12345 - أ - 1" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="immatWW"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Immatriculation WW (temporaire)</FormLabel>
                        <FormControl>
                            <Input placeholder="WW 123456" {...field} value={field.value ?? ''} />
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
                              <Input 
                                  type="number" 
                                  placeholder="54000"
                                  value={field.value ?? ''}
                                  onChange={field.onChange}
                                  onBlur={(e) => {
                                      const kmValue = e.target.value;
                                      field.onChange(kmValue === '' ? '' : Number(kmValue));
                                      const km = Number(kmValue);
                                      if (!isNaN(km) && km > 0 && isNewCar) {
                                          const vidangeInterval = 10000;
                                          form.setValue('maintenanceSchedule.prochainVidangeKm', km + vidangeInterval, { shouldValidate: true });
                                      } else if (kmValue === '' && isNewCar) {
                                           form.setValue('maintenanceSchedule.prochainVidangeKm', undefined, { shouldValidate: true });
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
                                    <Input type="text" placeholder="https://exemple.com/image.png" {...field} value={field.value ?? ''} />
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
                <AccordionTrigger>Documents & Historique</AccordionTrigger>
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
                                        field.onChange(new Date(dateString));
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
                                            field.onChange(new Date(dateString));
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
                        <div className="space-y-2">
                          <FormLabel>Historique d'entretien</FormLabel>
                          {isMaintenance && (
                            <div className="p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md">
                                Pour ajouter ou modifier l'intervention en cours, veuillez d'abord la terminer via l'action "Terminer la maintenance" sur la fiche du véhicule. La gestion de l'historique est désactivée pendant une maintenance.
                            </div>
                          )}
                          <div className="space-y-4">
                              {fields.map((item, index) => (
                                <div key={item.id} className={cn("p-4 border rounded-md space-y-4 relative", isMaintenance && "bg-muted/50 opacity-60 pointer-events-none")}>
                                  <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => remove(index)} disabled={isMaintenance}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <FormField
                                    control={form.control}
                                    name={`maintenanceHistory.${index}.date`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Date de l'intervention</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="date"
                                            disabled={isMaintenance}
                                            value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                                             onChange={(e) => {
                                                const dateString = e.target.value;
                                                let date: Date | null = null;
                                                if (dateString) {
                                                    date = new Date(dateString);
                                                }
                                                field.onChange(date);
                                            }}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <div className="grid grid-cols-2 gap-4">
                                     <FormField
                                        control={form.control}
                                        name={`maintenanceHistory.${index}.kilometrage`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Kilométrage</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    disabled={isMaintenance}
                                                    value={field.value ?? ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name={`maintenanceHistory.${index}.cout`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Coût (MAD)</FormLabel>
                                            <FormControl><Input type="number" {...field} value={field.value ?? ''} disabled={isMaintenance} /></FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                  </div>
                                  <FormField
                                    control={form.control}
                                    name={`maintenanceHistory.${index}.typeIntervention`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Type d'intervention</FormLabel>
                                         <Select onValueChange={field.onChange} value={field.value} disabled={isMaintenance}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sélectionner un type d'intervention" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            {Object.entries(maintenanceInterventionTypes).map(([group, options]) => (
                                                <SelectGroup key={group}>
                                                <SelectLabel>{group}</SelectLabel>
                                                {options.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                    {option}
                                                    </SelectItem>
                                                ))}
                                                </SelectGroup>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                   <FormField
                                    control={form.control}
                                    name={`maintenanceHistory.${index}.description`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl><Textarea placeholder="Détails des travaux effectués..." {...field} disabled={isMaintenance} /></FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => append({
                                  date: new Date(),
                                  kilometrage: form.getValues('kilometrage') || 0,
                                  typeIntervention: '',
                                  description: '',
                                  cout: undefined,
                                })}
                                disabled={isMaintenance}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Ajouter une intervention
                              </Button>
                          </div>
                        </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
                <AccordionTrigger>Plan d'Entretien (Alertes)</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                    <FormDescription>
                        Définissez les rappels pour les entretiens importants. Le système vous alertera lorsque l'échéance approche.
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="maintenanceSchedule.prochainVidangeKm"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prochaine vidange (km)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Auto" {...field} value={field.value ?? ''} readOnly />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="maintenanceSchedule.prochainFiltreGasoilKm"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prochain filtre gazole (km)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Manuel" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maintenanceSchedule.prochainesPlaquettesFreinKm"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prochaines plaquettes (km)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Manuel" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maintenanceSchedule.prochaineCourroieDistributionKm"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prochaine distribution (km)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Manuel" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>

        
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting || isMaintenance}>
          {isSubmitting ? 'Enregistrement...' : (car ? 'Mettre à jour la voiture' : 'Ajouter une voiture')}
        </Button>
      </form>
    </Form>
  );
}
