
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
import { useToast } from "@/hooks/use-toast";
import type { Rental, Car as CarType, Client, DamageType, Damage, Inspection } from "@/lib/definitions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { Calendar } from "../ui/calendar";
import { cn, formatCurrency } from "@/lib/utils";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { fr } from 'date-fns/locale';
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { Slider } from "../ui/slider";
import CarDamageDiagram, { carParts } from "./car-damage-diagram";
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, setDoc, writeBatch, Timestamp, updateDoc, getDoc, getDocs } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "../ui/skeleton";

const damageTypeEnum = z.enum(['rayure', 'rayure_importante', 'choc', 'a_remplacer']);

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
  kilometrageDepart: z.coerce.number({invalid_type_error: "Le kilométrage est requis."}).int().min(0, "Le kilométrage doit être positif."),
  carburantNiveauDepart: z.number().min(0).max(1),
  roueSecours: z.boolean().default(false),
  posteRadio: z.boolean().default(false),
  lavage: z.boolean().default(false),
  dommagesDepartNotes: z.string().optional(),
  dommagesDepart: z.record(z.string(), damageTypeEnum).optional(),
  photosDepart: z.array(z.object({ url: z.string().url("Veuillez entrer une URL valide.").or(z.literal('')) })).optional(),
  
  // Champs de retour
  kilometrageRetour: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).positive("Le kilométrage de retour doit être un nombre positif.").optional()
  ),
  carburantNiveauRetour: z.number().min(0).max(1).optional(),
  roueSecoursRetour: z.boolean().default(true).optional(),
  posteRadioRetour: z.boolean().default(true).optional(),
  lavageRetour: z.boolean().default(true).optional(),
  dommagesRetourNotes: z.string().optional(),
  dommagesRetour: z.record(z.string(), damageTypeEnum).optional(),
  photosRetour: z.array(z.object({ url: z.string().url("Veuillez entrer une URL valide.").or(z.literal('')) })).optional(),
  dateRetour: z.date().optional(),
});

// A robust function to convert Firestore Timestamps or other formats to a JS Date object.
const timestampToDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp instanceof Timestamp) return timestamp.toDate();
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
}

function getSafeDate(date: any): Date | undefined {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
}

type RentalFormProps = {
    rental: Rental | null,
    clients: Client[],
    cars: CarType[],
    onFinished: () => void,
    mode: 'new' | 'edit' | 'check-in'
};

export default function RentalForm({ rental, clients, cars, onFinished, mode }: RentalFormProps) {
  const { toast } = useToast();
  const { firestore, auth } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = React.useState(mode !== 'new');

  const rentalFormSchema = React.useMemo(() => {
    if (mode === 'check-in') {
        return baseSchema.extend({
            kilometrageRetour: z.coerce.number({
                required_error: "Le kilométrage de retour est requis.",
                invalid_type_error: "Veuillez entrer un nombre valide.",
            }).int().positive("Le kilométrage de retour doit être un nombre positif."),
            dateRetour: z.date({
                required_error: "La date de retour effective est requise."
            })
        }).refine(data => {
            if (typeof data.kilometrageRetour === 'number' && typeof data.kilometrageDepart === 'number') {
                return data.kilometrageRetour >= data.kilometrageDepart;
            }
            return true;
        }, {
            message: "Le kilométrage de retour ne peut être inférieur à celui de départ.",
            path: ["kilometrageRetour"],
        }).refine(data => {
            if (data.dateRetour && data.dateRange?.from) {
               return data.dateRetour >= data.dateRange.from
            }
            return true;
        }, {
            message: "La date de retour ne peut être antérieure à la date de début.",
            path: ["dateRetour"],
        });
    }
    return baseSchema.refine(data => {
        if (data.dateRange?.from && data.dateRange?.to) {
            return data.dateRange.to >= data.dateRange.from;
        }
        return true;
    }, {
        message: "La date de fin ne peut pas être antérieure à la date de début.",
        path: ["dateRange"],
    });
  }, [mode]);

  const newRentalInitialValues = {
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
      photosDepart: [],
      kilometrageRetour: undefined,
      carburantNiveauRetour: 0.5,
      dommagesRetourNotes: "",
      photosRetour: [],
      roueSecours: true,
      posteRadio: true,
      lavage: true,
      dateRetour: new Date(),
      roueSecoursRetour: true,
      posteRadioRetour: true,
      lavageRetour: true,
  };

  const [initialValues, setInitialValues] = React.useState(newRentalInitialValues);

  const form = useForm<z.infer<typeof rentalFormSchema>>({
    resolver: zodResolver(rentalFormSchema),
    mode: "onChange",
    defaultValues: initialValues,
  });
  
  const { control } = form;

  const { fields: departFields, append: appendDepart, remove: removeDepart } = useFieldArray({
    control, name: "photosDepart",
  });
  const { fields: retourFields, append: appendRetour, remove: removeRetour } = useFieldArray({
    control, name: "photosRetour",
  });


  React.useEffect(() => {
    const loadRentalData = async () => {
        if (!rental || !firestore) return;
        if (!isLoadingDefaults) setIsLoadingDefaults(true);

        const fetchInspection = async (inspectionId: string) => {
            if (!inspectionId) return null;
            const inspectionRef = doc(firestore, 'inspections', inspectionId);
            const inspectionSnap = await getDoc(inspectionRef);
            if (!inspectionSnap.exists()) return null;

            const damagesRef = collection(firestore, `inspections/${inspectionId}/damages`);
            const damagesSnap = await getDocs(damagesRef);
            const damagesData = damagesSnap.docs.reduce((acc, doc) => {
                const data = doc.data() as Omit<Damage, 'id'>;
                if (data.partName && data.damageType) {
                   acc[data.partName] = data.damageType;
                }
                return acc;
            }, {} as { [key: string]: DamageType });
            
            return { ...inspectionSnap.data(), damages: damagesData };
        };

        const rentalClient = clients.find(c => c.cin === rental.locataire.cin);
        const rentalConducteur2 = rental.conducteur2 ? clients.find(c => c.cin === rental.conducteur2.cin) : null;
        
        let livraisonData: any;
        let receptionData: any;

        if (rental.livraisonInspectionId) {
            const insp = await fetchInspection(rental.livraisonInspectionId);
            if (insp) {
               livraisonData = {
                   kilometrage: insp.kilometrage,
                   carburantNiveau: insp.carburantNiveau,
                   roueSecours: insp.roueSecours,
                   posteRadio: insp.posteRadio,
                   lavage: insp.lavage,
                   dommagesNotes: insp.notes,
                   damages: insp.damages,
                   photos: insp.photos || []
               }
            }
        } else if (rental.livraison) {
            livraisonData = rental.livraison; // backward compatibility
        }

        if (mode === 'check-in' && rental.receptionInspectionId) {
             const insp = await fetchInspection(rental.receptionInspectionId);
             if (insp) {
                receptionData = {
                   dateHeure: insp.timestamp,
                   kilometrage: insp.kilometrage,
                   carburantNiveau: insp.carburantNiveau,
                   roueSecours: insp.roueSecours,
                   posteRadio: insp.posteRadio,
                   lavage: insp.lavage,
                   dommagesNotes: insp.notes,
                   damages: insp.damages,
                   photos: insp.photos || []
                }
             }
        } else if (mode === 'check-in' && rental.reception) {
            receptionData = rental.reception; // backward compatibility
        }

        const defaults = {
            clientId: rentalClient?.id ?? "",
            conducteur2_clientId: rentalConducteur2?.id ?? '_none_',
            voitureId: rental.vehicule.carId,
            dateRange: { from: getSafeDate(rental.location.dateDebut)!, to: getSafeDate(rental.location.dateFin)! },
            caution: rental.location.depot,
            
            kilometrageDepart: livraisonData?.kilometrage,
            carburantNiveauDepart: livraisonData?.carburantNiveau,
            roueSecours: livraisonData?.roueSecours,
            posteRadio: livraisonData?.posteRadio,
            lavage: livraisonData?.lavage,
            dommagesDepartNotes: livraisonData?.dommagesNotes || "",
            dommagesDepart: livraisonData?.damages || {},
            photosDepart: (livraisonData?.photos || []).map((p: string) => ({url: p})),

            kilometrageRetour: receptionData?.kilometrage,
            carburantNiveauRetour: receptionData?.carburantNiveau,
            roueSecoursRetour: receptionData?.roueSecours ?? true,
            posteRadioRetour: receptionData?.posteRadio ?? true,
            lavageRetour: receptionData?.lavage ?? true,
            dommagesRetourNotes: receptionData?.dommagesNotes || "",
            dommagesRetour: receptionData?.damages || {},
            photosRetour: (receptionData?.photos || []).map((p: string) => ({url: p})),
            dateRetour: receptionData?.dateHeure ? getSafeDate(receptionData.dateHeure) : new Date(),
        };
        
        setInitialValues(defaults);
        form.reset(defaults);
        setIsLoadingDefaults(false);
    };

    if (mode === 'edit' || mode === 'check-in') {
        loadRentalData();
    } else {
         form.reset(newRentalInitialValues);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental, mode, firestore, clients]);
  
  const { setValue } = form;
  const selectedClientId = form.watch("clientId");
  const selectedCarId = form.watch("voitureId");
  const dateRange = form.watch("dateRange");
  const dateRetour = form.watch("dateRetour");

  React.useEffect(() => {
    if (selectedCarId && mode === 'new') {
      const selectedCar = cars.find(c => c.id === selectedCarId);
      if (selectedCar) {
        setValue('kilometrageDepart', selectedCar.kilometrage, { shouldValidate: true });
      }
    }
  }, [selectedCarId, cars, mode, setValue]);

  const availableCars = cars.filter(car => car.disponible || (rental && car.id === rental.vehicule.carId));

  const selectedCarForUI = React.useMemo(() => {
    return cars.find(car => car.id === selectedCarId);
  }, [selectedCarId, cars]);

  const rentalDaysForUI = React.useMemo(() => {
    const from = (mode === 'check-in' && rental) ? getSafeDate(rental.location.dateDebut) : dateRange?.from;
    const to = (mode === 'check-in' && rental) ? dateRetour : dateRange?.to;

    if (from && to) {
        const days = differenceInCalendarDays(startOfDay(to), startOfDay(from));
        return days < 1 ? 1 : days;
    }
    return 0;
  }, [dateRange, dateRetour, mode, rental]);

  const prixTotalForUI = React.useMemo(() => {
    const pricePerDay = rental ? rental.location.prixParJour : selectedCarForUI?.prixParJour;
    if (pricePerDay) {
        return rentalDaysForUI * pricePerDay;
    }
    return 0;
  }, [selectedCarForUI, rentalDaysForUI, rental]);

  const onError = (errors: any) => {
    if (Object.keys(errors).length > 0) {
      console.error("Form validation errors:", errors);
      const firstErrorKey = Object.keys(errors)[0];
      const firstErrorMessage = errors[firstErrorKey]?.message || (Array.isArray(errors[firstErrorKey]) ? errors[firstErrorKey][0].url.message : "Erreur de validation");
      
      toast({
          variant: "destructive",
          title: "Erreur de validation",
          description: firstErrorMessage || "Veuillez corriger les erreurs en surbrillance.",
      });
    }
  };

  async function onSubmit(data: z.infer<typeof rentalFormSchema>) {
    if (!firestore || !auth.currentUser) {
        toast({
            variant: "destructive",
            title: "Erreur d'authentification",
            description: "Vous devez être connecté pour effectuer cette action."
        });
        return;
    }
    
    setIsSubmitting(true);
    const userId = auth.currentUser.uid;
    
    const handleInspection = (
        rentalId: string, 
        carId: string, 
        type: 'depart' | 'retour',
        inspectionData: any,
        batch: import("firebase/firestore").WriteBatch
    ) => {
        const inspectionRef = doc(collection(firestore, 'inspections'));
        
        const photosArray = type === 'depart' ? inspectionData.photosDepart : inspectionData.photosRetour;
        const photoUrls = photosArray ? photosArray.map((item: {url:string}) => item.url.trim()).filter((url: string) => url) : [];

        const inspectionPayload = {
            vehicleId: carId,
            rentalId: rentalId,
            userId: userId,
            timestamp: type === 'depart' ? serverTimestamp() : inspectionData.dateRetour,
            type: type,
            notes: type === 'depart' ? inspectionData.dommagesDepartNotes : inspectionData.dommagesRetourNotes,
            kilometrage: type === 'depart' ? inspectionData.kilometrageDepart : inspectionData.kilometrageRetour,
            carburantNiveau: type === 'depart' ? inspectionData.carburantNiveauDepart : inspectionData.carburantNiveauRetour,
            roueSecours: type === 'depart' ? inspectionData.roueSecours : inspectionData.roueSecoursRetour,
            posteRadio: type === 'depart' ? inspectionData.posteRadio : inspectionData.posteRadioRetour,
            lavage: type === 'depart' ? inspectionData.lavage : inspectionData.lavageRetour,
            photos: photoUrls,
        };
        batch.set(inspectionRef, inspectionPayload);

        const damages = type === 'depart' ? inspectionData.dommagesDepart : inspectionData.dommagesRetour;
        if (damages) {
            for (const partId of Object.keys(damages)) {
                const damageType = damages[partId as keyof typeof damages];
                if (!damageType) continue;
                const partInfo = carParts.find(p => p.id === partId);
                const damageDocRef = doc(collection(firestore, `inspections/${inspectionRef.id}/damages`));
                const damagePayload: Omit<Damage, 'id'> = {
                    partName: partId,
                    damageType: damageType,
                    positionX: partInfo?.x || 0,
                    positionY: partInfo?.y || 0,
                };
                batch.set(damageDocRef, damagePayload);
            }
        }
        
        return inspectionRef.id;
    }


    try {
        const batch = writeBatch(firestore);

        if (mode === 'check-in' && rental) {
            const receptionInspectionId = handleInspection(rental.id, rental.vehicule.carId, 'retour', data, batch);
            
            const rentalRef = doc(firestore, 'rentals', rental.id);
            const carDocRef = doc(firestore, 'cars', rental.vehicule.carId);
            
            const finalRentalDays = rentalDaysForUI;
            const finalAmountToPay = finalRentalDays * rental.location.prixParJour;

            const updatePayload = {
                receptionInspectionId: receptionInspectionId,
                'location.dateFin': data.dateRetour,
                'location.nbrJours': finalRentalDays,
                'location.montantAPayer': finalAmountToPay,
                statut: 'terminee' as 'terminee',
            };

            batch.update(rentalRef, updatePayload);
            batch.update(carDocRef, { disponible: true, kilometrage: data.kilometrageRetour });

            await batch.commit();
            toast({
                title: "Location terminée",
                description: `La réception pour ${rental.locataire.nomPrenom} a été enregistrée.`,
            });
            onFinished();

        } else if (mode === 'edit' && rental) {
            const { dateRange } = data;
            const rentalRef = doc(firestore, 'rentals', rental.id);

            const dayDiff = differenceInCalendarDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
            const finalRentalDays = dayDiff < 1 ? 1 : dayDiff;
            const finalAmountToPay = finalRentalDays * rental.location.prixParJour;

            const updatePayload = {
                'location.dateFin': dateRange.to,
                'location.nbrJours': finalRentalDays,
                'location.montantAPayer': finalAmountToPay,
            };

            await updateDoc(rentalRef, updatePayload);
            toast({ title: "Contrat mis à jour", description: `La location a été étendue jusqu'au ${format(dateRange.to, "dd/MM/yyyy")}.` });
            onFinished();

        } else { // mode === 'new'
            const {
                voitureId,
                clientId,
                conducteur2_clientId,
                dateRange,
                caution,
            } = data;

            const selectedCar = cars.find(c => c.id === voitureId);
            const selectedClient = clients.find(c => c.id === clientId);
            const selectedConducteur2 = (conducteur2_clientId && conducteur2_clientId !== '_none_') 
                ? clients.find(c => c.id === conducteur2_clientId) 
                : null;

            if (!selectedCar || !selectedClient) {
                 throw new Error("Client ou voiture invalides. Veuillez réessayer.");
            }
            
            const dayDiff = differenceInCalendarDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
            const rentalDays = dayDiff < 1 ? 1 : dayDiff;
            const totalAmount = rentalDays * selectedCar.prixParJour;
            
            const safeDateMiseEnCirculation = timestampToDate(selectedCar.dateMiseEnCirculation);
            const newRentalRef = doc(collection(firestore, 'rentals'));
            
            const livraisonInspectionId = handleInspection(newRentalRef.id, selectedCar.id, 'depart', data, batch);

            const rentalPayload: Omit<Rental, 'id'> & {createdAt: any} = {
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
                        telephone: selectedConducteur2.telephone,
                    }
                }),
                vehicule: {
                    carId: selectedCar.id,
                    immatriculation: selectedCar.immat,
                    marque: `${selectedCar.marque} ${selectedCar.modele}`,
                    dateMiseEnCirculation: safeDateMiseEnCirculation,
                    couleur: selectedCar.couleur || "Inconnue",
                    nbrPlaces: selectedCar.nbrPlaces || 5,
                    puissance: selectedCar.puissance || 7,
                    carburantType: selectedCar.carburantType || 'Essence',
                    transmission: selectedCar.transmission || 'Manuelle',
                    photoURL: selectedCar.photoURL
                },
                livraisonInspectionId: livraisonInspectionId,
                location: {
                    dateDebut: dateRange.from,
                    dateFin: dateRange.to,
                    prixParJour: selectedCar.prixParJour,
                    nbrJours: rentalDays,
                    depot: caution || 0,
                    montantAPayer: totalAmount,
                },
                statut: 'en_cours' as 'en_cours',
                createdAt: serverTimestamp(),
            };
            
            const carDocRef = doc(firestore, 'cars', selectedCar.id);
            
            batch.set(newRentalRef, rentalPayload);
            batch.update(carDocRef, { disponible: false });

            await batch.commit();
            toast({
                title: "Contrat créé",
                description: `Le contrat pour ${selectedClient.nom} a été créé avec succès.`,
            });
            onFinished();
        }
    } catch (error: any) {
        console.error("Submission error:", error);
        toast({
            variant: "destructive",
            title: "Erreur",
            description: error.message || "Une erreur est survenue lors de l'enregistrement."
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const displayPricePerDay = rental ? rental.location.prixParJour : (selectedCarForUI?.prixParJour || 0);
  
  const buttonText = {
      new: 'Créer le contrat',
      edit: 'Mettre à jour le contrat',
      'check-in': 'Terminer et Réceptionner le Véhicule'
  };

  if (isLoadingDefaults) {
    return (
        <div className="space-y-4 mt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 mt-4">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', ...(mode === 'check-in' ? ['item-3'] : [])]} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Détails du contrat</AccordionTrigger>
                <AccordionContent className="space-y-4 px-1">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={mode !== 'new'}>
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
                                value={field.value || '_none_'} 
                                disabled={mode !== 'new'}
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
                          <Select onValueChange={field.onChange} value={field.value} disabled={mode !== 'new'}>
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
                                  disabled={mode === 'check-in'}
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
                                disabled={date => mode === 'new' ? date < new Date(new Date().setHours(0,0,0,0)) : (rental?.location?.dateDebut ? date < getSafeDate(rental.location.dateDebut)! : false)}
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
                            <Input type="number" placeholder="5000" {...field} value={field.value ?? ''} readOnly={mode !== 'new'} />
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
                            <Input type="number" placeholder="64000" {...field} value={field.value ?? ''} readOnly={mode !== 'new'} />
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
                                disabled={mode !== 'new'}
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
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} />
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
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} />
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
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} />
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
                                    <FormDescription>Cliquez sur une zone pour spécifier le type de dommage.</FormDescription>
                                    <FormControl>
                                        <CarDamageDiagram 
                                            damages={field.value || {}} 
                                            onDamagesChange={field.onChange} 
                                            readOnly={mode !== 'new'}
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
                            <Textarea placeholder="Décrivez tout autre dommage ou note pertinente ici..." {...field} value={field.value ?? ''} readOnly={mode !== 'new'} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                        <FormLabel>Photos du véhicule (Départ)</FormLabel>
                        <div className="space-y-2">
                            {departFields.map((item, index) => (
                                <FormField
                                    key={item.id}
                                    control={control}
                                    name={`photosDepart.${index}.url`}
                                    render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="https://exemple.com/photo.jpg"
                                            readOnly={mode !== 'new'}
                                            className="h-9"
                                        />
                                        </FormControl>
                                        {mode === 'new' && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 shrink-0 text-destructive"
                                            onClick={() => removeDepart(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        )}
                                        <FormMessage className="ml-2" />
                                    </FormItem>
                                    )}
                                />
                            ))}
                            {mode === 'new' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => appendDepart({ url: '' })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Ajouter une URL de photo
                                </Button>
                            )}
                        </div>
                        {mode !== 'new' && departFields.length === 0 && (
                            <p className="text-sm text-muted-foreground pt-2">Aucune photo enregistrée pour le départ.</p>
                        )}
                    </FormItem>
                </AccordionContent>
            </AccordionItem>
            
            {mode === 'check-in' && rental && (
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
                                    disabled={(date) => date < (getSafeDate(rental.location.dateDebut) || new Date())}
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
                        <FormLabel>Checklist des équipements (Retour)</FormLabel>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <FormField
                              control={form.control}
                              name="roueSecoursRetour"
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
                              name="posteRadioRetour"
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
                              name="lavageRetour"
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
                    <FormItem>
                        <FormLabel>Photos du véhicule (Retour)</FormLabel>
                        <div className="space-y-2">
                             {retourFields.map((item, index) => (
                                <FormField
                                    key={item.id}
                                    control={control}
                                    name={`photosRetour.${index}.url`}
                                    render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="https://exemple.com/photo.jpg"
                                            className="h-9"
                                        />
                                        </FormControl>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 shrink-0 text-destructive"
                                            onClick={() => removeRetour(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <FormMessage className="ml-2" />
                                    </FormItem>
                                    )}
                                />
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => appendRetour({ url: '' })}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter une URL de photo
                            </Button>
                        </div>
                    </FormItem>
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
                <div className="flex justify-between"><span>Durée de la location :</span> <span className="font-medium">{rentalDaysForUI} jour(s)</span></div>
                <div className="flex justify-between font-semibold text-lg"><span>Montant à Payer :</span> <span>{formatCurrency(prixTotalForUI, 'MAD')}</span></div>
            </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : buttonText[mode]}
        </Button>
      </form>
    </Form>
  );
}
