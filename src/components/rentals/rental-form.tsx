
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
import { useToast } from "@/hooks/use-toast";
import type { Rental, Car as CarType, Client } from "@/lib/definitions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../ui/calendar";
import { cn, formatCurrency } from "@/lib/utils";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from 'date-fns/locale';
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { Slider } from "../ui/slider";
import CarDamageDiagram from "./car-damage-diagram";
import { useFirebase } from "@/firebase";
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Switch } from "../ui/switch";


const baseSchema = z.object({
  clientId: z.string({ required_error: "Veuillez sélectionner un client." }).min(1, "Veuillez sélectionner un client."),
  conducteur2_clientId: z.string().optional(),
  voitureId: z.string({ required_error: "Veuillez sélectionner une voiture." }).min(1, "Veuillez sélectionner une voiture."),
  dateRange: z.object({
    from: z.date({ required_error: "Une date de début est requise." }),
    to: z.date({ required_error: "Une date de fin est requise." }),
  }),
  caution: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, "La caution ne peut pas être négative.").optional()
  ),
  kilometrageDepart: z.coerce.number().int().min(0, "Le kilométrage doit être positif."),
  carburantNiveauDepart: z.number().min(0).max(1),
  roueSecours: z.boolean().default(false),
  posteRadio: z.boolean().default(false),
  lavage: z.boolean().default(false),
  dommagesDepartNotes: z.string().optional(),
  dommagesDepart: z.record(z.string(), z.boolean()).optional(),
  
  // Champs de retour
  kilometrageRetour: z.coerce.number().optional(),
  carburantNiveauRetour: z.number().min(0).max(1).optional(),
  dommagesRetourNotes: z.string().optional(),
  dommagesRetour: z.record(z.string(), z.boolean()).optional(),
  dateRetour: z.date().optional(),
});


function getSafeDate(date: any): Date | undefined {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
}

const updateRentalFormSchema = baseSchema.extend({
    kilometrageRetour: z.coerce.number({
        required_error: "Le kilométrage de retour est requis.",
        invalid_type_error: "Veuillez entrer un nombre valide.",
    }).int().min(1, "Le kilométrage de retour doit être un nombre positif."),
    dateRetour: z.date({
        required_error: "La date de retour effective est requise."
    })
}).refine(data => data.kilometrageRetour >= data.kilometrageDepart, {
    message: "Le kilométrage de retour ne peut être inférieur à celui de départ.",
    path: ["kilometrageRetour"],
}).refine(data => data.dateRetour >= data.dateRange.from, {
    message: "La date de retour ne peut être antérieure à la date de début.",
    path: ["dateRetour"],
});


export default function RentalForm({ rental, clients, cars, onFinished }: { rental: Rental | null, clients: Client[], cars: CarType[], onFinished: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const { firestore } = useFirebase();
  const isUpdate = !!rental;
  
  const rentalFormSchema = isUpdate ? updateRentalFormSchema : baseSchema;

  const getInitialValues = React.useCallback(() => {
    if (rental) {
        const rentalClient = clients.find(c => c.cin === rental.locataire.cin);
        const rentalConducteur2 = rental.conducteur2 ? clients.find(c => c.cin === rental.conducteur2.cin) : null;
        return {
            clientId: rentalClient?.id ?? "",
            conducteur2_clientId: rentalConducteur2?.id ?? "_none_",
            voitureId: rental.vehicule.carId,
            dateRange: { from: getSafeDate(rental.location.dateDebut)!, to: getSafeDate(rental.location.dateFin)! },
            caution: rental.location.depot,
            kilometrageDepart: rental.livraison.kilometrage,
            carburantNiveauDepart: rental.livraison.carburantNiveau,
            roueSecours: rental.livraison.roueSecours,
            posteRadio: rental.livraison.posteRadio,
            lavage: rental.livraison.lavage,
            dommagesDepartNotes: rental.livraison.dommagesNotes || "",
            dommagesDepart: rental.livraison.dommages?.reduce((acc, curr) => ({...acc, [curr]: true}), {}),
            kilometrageRetour: rental.reception?.kilometrage,
            carburantNiveauRetour: rental.reception?.carburantNiveau,
            dommagesRetourNotes: rental.reception?.dommagesNotes || "",
            dommagesRetour: rental.reception?.dommages?.reduce((acc, curr) => ({...acc, [curr]: true}), {}),
            dateRetour: rental.reception?.dateHeure ? getSafeDate(rental.reception.dateHeure) : new Date(),
        };
    }
    // Default values for a new rental
    return {
        clientId: "",
        conducteur2_clientId: "_none_",
        voitureId: "",
        dateRange: undefined,
        kilometrageDepart: '' as any,
        caution: undefined,
        carburantNiveauDepart: 0.5,
        dommagesDepart: {},
        dommagesRetour: {},
        dommagesDepartNotes: "",
        kilometrageRetour: undefined,
        carburantNiveauRetour: 0.5,
        dommagesRetourNotes: "",
        roueSecours: true,
        posteRadio: true,
        lavage: true,
        dateRetour: new Date(),
    }
  }, [rental, clients]);

  const form = useForm<z.infer<typeof rentalFormSchema>>({
    resolver: zodResolver(rentalFormSchema),
    mode: "onChange",
    defaultValues: getInitialValues(),
  });
  
  const selectedClientId = form.watch("clientId");
  const selectedCarId = form.watch("voitureId");
  const dateRange = form.watch("dateRange");
  const dateRetour = form.watch("dateRetour");

  const availableCars = cars.filter(car => car.disponible || (rental && car.id === rental.vehicule.carId));

  const selectedCarForUI = React.useMemo(() => {
    return cars.find(car => car.id === selectedCarId);
  }, [selectedCarId, cars]);

  const rentalDaysForUI = React.useMemo(() => {
    const fromDate = dateRange?.from;
    let toDate = dateRange?.to;

    if (isUpdate && dateRetour) {
        toDate = dateRetour;
    }

    if (fromDate && toDate) {
        const days = differenceInCalendarDays(toDate, fromDate);
        return days >= 0 ? days + 1 : 0;
    }
    return 0;
  }, [dateRange, dateRetour, isUpdate]);

  const prixTotalForUI = React.useMemo(() => {
    if (selectedCarForUI) {
        return rentalDaysForUI * selectedCarForUI.prixParJour;
    }
    return 0;
  }, [selectedCarForUI, rentalDaysForUI]);

  const onError = (errors: any) => {
    console.error("Form validation errors:", errors);
    const firstErrorKey = Object.keys(errors)[0];
    const firstErrorMessage = errors[firstErrorKey]?.message;
    
    toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: firstErrorMessage || "Veuillez corriger les erreurs en surbrillance.",
    });
  };

  async function onSubmit(data: z.infer<typeof rentalFormSchema>) {
    if (!firestore) return;
    
    if (isUpdate && rental) {
        // --- UPDATE LOGIC ---
        const rentalRef = doc(firestore, 'rentals', rental.id);
        const carDocRef = doc(firestore, 'cars', rental.vehicule.carId);
        
        const finalRentalDays = rentalDaysForUI;
        const finalAmountToPay = finalRentalDays * rental.location.prixParJour;

        const updatePayload = {
            reception: {
                dateHeure: data.dateRetour,
                kilometrage: data.kilometrageRetour,
                carburantNiveau: data.carburantNiveauRetour,
                dommages: Object.keys(data.dommagesRetour || {}).filter(k => data.dommagesRetour?.[k]),
                dommagesNotes: data.dommagesRetourNotes || "",
            },
            'location.dateFin': data.dateRetour,
            'location.nbrJours': finalRentalDays,
            'location.montantAPayer': finalAmountToPay,
            statut: 'terminee' as 'terminee',
        };

        const batch = writeBatch(firestore);
        batch.update(rentalRef, updatePayload);
        batch.update(carDocRef, { disponible: true });

        try {
            await batch.commit();
            toast({
                title: "Location terminée",
                description: `La réception pour ${rental.locataire.nomPrenom} a été enregistrée avec le montant final de ${formatCurrency(finalAmountToPay, 'MAD')}.`,
            });
            onFinished();
            router.refresh();
        } catch (serverError) {
            const permissionError = new FirestorePermissionError({
                path: `batch write for ${rentalRef.path} and ${carDocRef.path}`,
                operation: 'update',
                requestResourceData: updatePayload
            }, serverError as Error);
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: "Erreur",
                description: "Impossible de terminer la location. L'opération a échoué."
            });
        }
    } else {
        // --- CREATE LOGIC ---
        const selectedCar = cars.find(c => c.id === data.voitureId);
        const selectedClient = clients.find(c => c.id === data.clientId);
        const selectedConducteur2 = (data.conducteur2_clientId && data.conducteur2_clientId !== '_none_') 
            ? clients.find(c => c.id === data.conducteur2_clientId) 
            : null;

        if (!selectedCar || !selectedClient) {
            toast({
                variant: "destructive",
                title: "Erreur de validation",
                description: "Client ou voiture non sélectionné. Veuillez rafraîchir et réessayer.",
            });
            return;
        }

        const rentalDays = differenceInCalendarDays(data.dateRange.to, data.dateRange.from) + 1;
        const totalAmount = rentalDays * selectedCar.prixParJour;
        
        const rentalPayload = {
            locataire: {
                cin: selectedClient.cin,
                nomPrenom: selectedClient.nom,
                permisNo: selectedClient.permisNo || 'N/A',
                telephone: selectedClient.telephone,
            },
            ...(selectedConducteur2 && {
                conducteur2: {
                    nomPrenom: selectedConducteur2.nom,
                    cin: selectedConducteur2.cin,
                    permisNo: selectedConducteur2.permisNo || 'N/A',
                }
            }),
            vehicule: {
                carId: selectedCar.id,
                immatriculation: selectedCar.immat,
                marque: `${selectedCar.marque} ${selectedCar.modele}`,
                modeleAnnee: selectedCar.modeleAnnee || new Date().getFullYear(),
                couleur: selectedCar.couleur || "Inconnue",
                nbrPlaces: selectedCar.nbrPlaces || 5,
                puissance: selectedCar.puissance || 7,
                carburantType: selectedCar.carburantType || 'Essence',
                photoURL: selectedCar.photoURL
            },
            livraison: {
                dateHeure: serverTimestamp(),
                kilometrage: data.kilometrageDepart,
                carburantNiveau: data.carburantNiveauDepart,
                roueSecours: data.roueSecours,
                posteRadio: data.posteRadio,
                lavage: data.lavage,
                dommages: Object.keys(data.dommagesDepart || {}).filter(k => data.dommagesDepart?.[k]),
                dommagesNotes: data.dommagesDepartNotes || "",
            },
            reception: {},
            location: {
                dateDebut: data.dateRange.from,
                dateFin: data.dateRange.to,
                prixParJour: selectedCar.prixParJour,
                nbrJours: rentalDays,
                depot: data.caution || 0,
                montantAPayer: totalAmount,
            },
            statut: 'en_cours' as 'en_cours',
            createdAt: serverTimestamp(),
        };
        
        const newRentalRef = doc(collection(firestore, 'rentals'));
        const carDocRef = doc(firestore, 'cars', selectedCar.id);
        const batch = writeBatch(firestore);

        batch.set(newRentalRef, rentalPayload);
        batch.update(carDocRef, { disponible: false });

        try {
            await batch.commit();
            toast({
                title: "Contrat créé",
                description: `Le contrat pour ${selectedClient.nom} a été créé avec succès.`,
            });
            onFinished();
            router.refresh();
        } catch (serverError: any) {
            const permissionError = new FirestorePermissionError({
                path: `batch write for ${newRentalRef.path} and ${carDocRef.path}`,
                operation: 'create',
                requestResourceData: rentalPayload
            }, serverError);
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: "destructive",
                title: "Erreur lors de la création",
                description: "Une erreur est survenue. Vérifiez vos permissions et réessayez.",
            });
        }
    }
  }

  const displayPricePerDay = isUpdate ? rental.location.prixParJour : (selectedCarForUI?.prixParJour || 0);
  const displayRentalDays = rentalDaysForUI;
  const displayTotalPrice = isUpdate ? (rentalDaysForUI * rental.location.prixParJour) : prixTotalForUI;
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 mt-4">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', ...(rental ? ['item-3'] : [])]} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Détails du contrat</AccordionTrigger>
                <AccordionContent className="space-y-4 px-1">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isUpdate}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.nom} ({client.cin})</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="conducteur2_clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deuxième conducteur (Optionnel)</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value} 
                            disabled={isUpdate}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un deuxième conducteur" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                               <SelectItem value="_none_">Aucun</SelectItem>
                               {clients.filter(client => client.id !== selectedClientId).map(client => (
                                <SelectItem key={client.id} value={client.id}>{client.nom} ({client.cin})</SelectItem>
                               ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="voitureId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voiture</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isUpdate}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Sélectionner une voiture disponible" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableCars.map(car => <SelectItem key={car.id} value={car.id}>{car.marque} {car.modele} ({car.immat})</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateRange"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Période de location (prévue)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  disabled={isUpdate}
                                  className={cn("w-full pl-3 text-left font-normal", !field.value?.from && "text-muted-foreground")}
                                >
                                  {field.value?.from ? (
                                    field.value.to ? (
                                      <>
                                        {format(field.value.from, "dd LLL, y", { locale: fr })} -{" "}
                                        {format(field.value.to, "dd LLL, y", { locale: fr })}
                                      </>
                                    ) : (
                                      format(field.value.from, "dd LLL, y", { locale: fr })
                                    )
                                  ) : (
                                    <span>Choisir une plage de dates</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={field.value?.from}
                                selected={{from: field.value?.from, to: field.value?.to}}
                                onSelect={field.onChange}
                                numberOfMonths={2}
                                locale={fr}
                                disabled={isUpdate}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="caution"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Caution (MAD)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="5000" {...field} value={field.value ?? ''} readOnly={isUpdate} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
                <AccordionTrigger>Contrat de Livraison (Départ)</AccordionTrigger>
                <AccordionContent className="space-y-4 px-1">
                     <FormField
                      control={form.control}
                      name="kilometrageDepart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kilométrage de départ</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="64000" {...field} value={field.value ?? ''} readOnly={isUpdate} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="carburantNiveauDepart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Niveau de carburant: {Math.round((field.value || 0) * 100)}%</FormLabel>
                           <FormControl>
                             <Slider
                                value={[field.value || 0]}
                                onValueChange={(values) => field.onChange(values[0])}
                                max={1}
                                step={0.125}
                                disabled={isUpdate}
                              />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div>
                        <FormLabel>Checklist des équipements</FormLabel>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <FormField
                              control={form.control}
                              name="roueSecours"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isUpdate} />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Roue de secours</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                             <FormField
                              control={form.control}
                              name="posteRadio"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isUpdate} />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Poste Radio</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                             <FormField
                              control={form.control}
                              name="lavage"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isUpdate} />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Voiture propre</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                        </div>
                    </div>

                    <div>
                        <FormField
                            control={form.control}
                            name="dommagesDepart"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Schéma des dommages (Départ)</FormLabel>
                                    <FormDescription>Cliquez sur les zones pour marquer les dommages existants.</FormDescription>
                                    <FormControl>
                                        <CarDamageDiagram 
                                            damages={field.value || {}} 
                                            onDamagesChange={field.onChange} 
                                            readOnly={isUpdate}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                     <FormField
                      control={form.control}
                      name="dommagesDepartNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Autres dommages / Notes (Départ)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Décrivez tout autre dommage ou note pertinente ici..." {...field} value={field.value ?? ''} readOnly={isUpdate} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </AccordionContent>
            </AccordionItem>
            
            {rental && (
              <AccordionItem value="item-3">
                  <AccordionTrigger>Contrat de Réception (Retour)</AccordionTrigger>
                  <AccordionContent className="space-y-4 px-1">
                      <p className="text-sm text-muted-foreground">Remplissez cette section lors du retour du véhicule.</p>
                       <FormField
                        control={form.control}
                        name="dateRetour"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Date de retour effective</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
                                    initialFocus
                                    locale={fr}
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                      <FormField
                        control={form.control}
                        name="kilometrageRetour"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kilométrage de retour</FormLabel>
                            <FormControl>
                              <Input
                                  type="number"
                                  placeholder="65500"
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
                        name="carburantNiveauRetour"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Niveau de carburant au retour: {field.value ? Math.round(field.value * 100) : 0}%</FormLabel>
                            <FormControl>
                              <Slider
                                  value={[field.value || 0]}
                                  onValueChange={(values) => field.onChange(values[0])}
                                  max={1}
                                  step={0.125}
                                />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                          <FormField
                              control={form.control}
                              name="dommagesRetour"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Schéma des dommages (Retour)</FormLabel>
                                      <FormDescription>Marquez les nouveaux dommages constatés au retour.</FormDescription>
                                      <FormControl>
                                          <CarDamageDiagram 
                                              damages={field.value || {}} 
                                              onDamagesChange={field.onChange} 
                                          />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                      </div>
                      <FormField
                        control={form.control}
                        name="dommagesRetourNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes sur les dommages (Retour)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Décrivez les nouveaux dommages ou frais supplémentaires..." {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  </AccordionContent>
              </AccordionItem>
            )}
        </Accordion>
        
        <Card className="bg-muted/50">
            <CardHeader>
                <CardTitle className="text-lg">Résumé du contrat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Prix par jour :</span> <span className="font-medium">{formatCurrency(displayPricePerDay, 'MAD')}</span></div>
                <div className="flex justify-between"><span>Durée de la location :</span> <span className="font-medium">{displayRentalDays} jour(s)</span></div>
                <div className="flex justify-between font-semibold text-lg"><span>Montant à Payer :</span> <span>{formatCurrency(displayTotalPrice, 'MAD')}</span></div>
            </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enregistrement..." : (rental ? 'Terminer et Réceptionner le Véhicule' : 'Créer le contrat')}
        </Button>
      </form>
    </Form>
  );
}
