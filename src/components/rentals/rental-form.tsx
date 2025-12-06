
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
import CarDamageDiagram, { type DamagePart } from "./car-damage-diagram";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const rentalFormSchema = z.object({
  clientId: z.string({ required_error: "Veuillez sélectionner un client." }),
  voitureId: z.string({ required_error: "Veuillez sélectionner une voiture." }),
  dateRange: z.object({
    from: z.date({ required_error: "Une date de début est requise." }),
    to: z.date({ required_error: "Une date de fin est requise." }),
  }),
  caution: z.coerce.number().min(0, "La caution ne peut pas être négative.").optional(),
  kilometrageDepart: z.coerce.number().min(0, "Le kilométrage doit être positif."),
  carburantNiveauDepart: z.number().min(0).max(1),
  roueSecours: z.boolean().default(false),
  posteRadio: z.boolean().default(false),
  lavage: z.boolean().default(false),
  dommagesDepartNotes: z.string().optional(),
  dommagesDepart: z.record(z.string(), z.boolean()).optional(),
  kilometrageRetour: z.coerce.number().min(0, "Le kilométrage doit être positif.").optional(),
  carburantNiveauRetour: z.number().min(0).max(1).optional(),
  dommagesRetourNotes: z.string().optional(),
  dommagesRetour: z.record(z.string(), z.boolean()).optional(),
});

type RentalFormValues = z.infer<typeof rentalFormSchema>;

export default function RentalForm({ rental, onFinished }: { rental: Rental | null, onFinished: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const { firestore } = useFirebase();

  const [cars, setCars] = React.useState<CarType[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);

  React.useEffect(() => {
    if (!firestore) return;
    const carsUnsubscribe = onSnapshot(collection(firestore, "cars"), (snapshot) => {
      setCars(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CarType)));
    });
    const clientsUnsubscribe = onSnapshot(collection(firestore, "clients"), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => {
      carsUnsubscribe();
      clientsUnsubscribe();
    };
  }, [firestore]);
  
  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    mode: "onChange",
    defaultValues: rental ? {
        clientId: rental.locataire.cin, // Assuming cin is used as id
        voitureId: rental.vehicule.immatriculation,
        dateRange: { from: new Date(rental.location.dateDebut), to: new Date(rental.location.dateFin)},
        caution: rental.location.depot,
        kilometrageDepart: rental.livraison.kilometrage,
        carburantNiveauDepart: rental.livraison.carburantNiveau,
        roueSecours: rental.livraison.roueSecours,
        posteRadio: rental.livraison.posteRadio,
        lavage: rental.livraison.lavage,
        // dommagesDepartNotes and dommagesDepart would need mapping
      } : {
      carburantNiveauDepart: 0.5,
      dommagesDepart: {},
      dommagesRetour: {}
    }
  });
  
  const selectedCarId = form.watch("voitureId");
  const dateRange = form.watch("dateRange");

  const availableCars = cars.filter(car => car.disponible || car.id === rental?.vehicule.immatriculation);

  const selectedCar = React.useMemo(() => {
    return cars.find(car => car.id === selectedCarId);
  }, [selectedCarId, cars]);
  
  const selectedClient = React.useMemo(() => {
    return clients.find(client => client.id === form.watch("clientId"));
    }, [form.watch("clientId"), clients]);


  const rentalDays = React.useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
        return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    }
    return 0;
  }, [dateRange]);

  const prixTotal = React.useMemo(() => {
    if (selectedCar && rentalDays > 0) {
        return selectedCar.prixParJour * rentalDays;
    }
    return 0;
  }, [selectedCar, rentalDays]);

  async function onSubmit(data: RentalFormValues) {
    if (!selectedCar || !selectedClient) {
        toast({ variant: "destructive", title: "Erreur", description: "Veuillez sélectionner un client et une voiture." });
        return;
    }

    const rentalPayload = {
      locataire: {
        cin: selectedClient.id,
        nomPrenom: selectedClient.nom,
        permisNo: selectedClient.permisNo || 'N/A',
        telephone: selectedClient.telephone,
      },
      vehicule: {
        immatriculation: selectedCar.id,
        marque: `${selectedCar.marque} ${selectedCar.modele}`,
        modeleAnnee: selectedCar.modeleAnnee,
        couleur: selectedCar.couleur,
        nbrPlaces: selectedCar.nbrPlaces,
        puissance: selectedCar.puissance,
        carburantType: selectedCar.carburantType,
        photoURL: selectedCar.photoURL
      },
      livraison: {
        dateHeure: new Date().toISOString(),
        kilometrage: data.kilometrageDepart,
        carburantNiveau: data.carburantNiveauDepart,
        roueSecours: data.roueSecours,
        posteRadio: data.posteRadio,
        lavage: data.lavage,
        dommages: Object.keys(data.dommagesDepart || {}).filter(k => data.dommagesDepart?.[k]),
        dommagesNotes: data.dommagesDepartNotes,
      },
      reception: {},
      location: {
        dateDebut: data.dateRange.from.toISOString(),
        dateFin: data.dateRange.to.toISOString(),
        prixParJour: selectedCar.prixParJour,
        nbrJours: rentalDays,
        depot: data.caution,
        montantAPayer: prixTotal,
      },
      statut: 'en_cours',
      createdAt: serverTimestamp(),
    };

    const rentalsCollection = collection(firestore, 'rentals');
    const carDocRef = doc(firestore, 'cars', selectedCar.id);

    try {
        await addDoc(rentalsCollection, rentalPayload);
        await updateDoc(carDocRef, { disponible: false });

        toast({
            title: "Contrat de location créé",
            description: `La location pour ${selectedClient.nom} a été créée avec succès.`,
        });
        onFinished();
        router.refresh();
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: rentalsCollection.path,
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
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Détails de la Location</AccordionTrigger>
                <AccordionContent className="space-y-4 px-1">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.nom}</SelectItem>)}
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Sélectionner une voiture disponible" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableCars.map(car => <SelectItem key={car.id} value={car.id}>{car.marque} {car.modele}</SelectItem>)}
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
                          <FormLabel>Période de location</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
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
                            <Input type="number" placeholder="5000" {...field} />
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
                            <Input type="number" placeholder="64000" {...field} />
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
                          <FormLabel>Niveau de carburant: {Math.round(field.value * 100)}%</FormLabel>
                           <FormControl>
                             <Slider
                                defaultValue={[field.value]}
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
                        <FormLabel>Checklist des équipements</FormLabel>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <FormField
                              control={form.control}
                              name="roueSecours"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                            <Textarea placeholder="Décrivez tout autre dommage ou note pertinente ici..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" disabled={!rental}>
                <AccordionTrigger>Contrat de Réception (Retour)</AccordionTrigger>
                <AccordionContent className="space-y-4 px-1">
                    <p className="text-sm text-muted-foreground">Remplissez cette section lors du retour du véhicule.</p>
                     <FormField
                      control={form.control}
                      name="kilometrageRetour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kilométrage de retour</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="65500" {...field} value={field.value ?? ''} />
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
                                defaultValue={[field.value || 0]}
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
                            <Textarea placeholder="Décrivez les nouveaux dommages ou frais supplémentaires..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
        
        <Card className="bg-muted/50">
            <CardHeader>
                <CardTitle className="text-lg">Résumé de la location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Prix par jour :</span> <span className="font-medium">{selectedCar ? formatCurrency(selectedCar.prixParJour, 'MAD') : '0,00 MAD'}</span></div>
                <div className="flex justify-between"><span>Durée de la location :</span> <span className="font-medium">{rentalDays} jour(s)</span></div>
                <div className="flex justify-between font-semibold text-lg"><span>Montant à Payer :</span> <span>{formatCurrency(prixTotal, 'MAD')}</span></div>
            </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting || !form.formState.isValid}>
          {form.formState.isSubmitting ? "Enregistrement..." : (rental ? 'Mettre à jour le contrat' : 'Créer la location')}
        </Button>
      </form>
    </Form>
  );
}
