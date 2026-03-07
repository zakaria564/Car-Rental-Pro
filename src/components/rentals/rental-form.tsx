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
import { CalendarIcon, Plus, Trash2, ExternalLink, CheckCircle, DollarSign } from "lucide-react";
import { Calendar } from "../ui/calendar";
import { cn, formatCurrency, getSafeDate, calculateTotalRentalAmount } from "@/lib/utils";
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
import { collection, doc, serverTimestamp, setDoc, writeBatch, Timestamp, updateDoc, getDoc, getDocs, query, where, orderBy, limit, runTransaction } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "../ui/skeleton";
import PaymentForm from "../payments/payment-form";

const damageTypeEnum = z.enum(['R', 'E', 'C', 'X']);

const baseSchema = z.object({
  clientId: z.string({ required_error: "Veuillez sélectionner un client." }).min(1, "Veuillez sélectionner un client."),
  conducteur2_clientId: z.string().optional(),
  voitureId: z.string({ required_error: "Veuillez sélectionner une voiture." }).min(1, "Veuillez sélectionner une voiture."),
  dateRange: z.object({
    from: z.date({ required_error: "Une date de début est requise." }),
    to: z.date({ required_error: "Une date de fin est requise." }),
  }),
  lieuDepart: z.string().optional(),
  lieuRetour: z.string().optional(),
  caution: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, "La caution ne peut pas être négative.").optional()
  ),
  kilometrageDepart: z.coerce.number({invalid_type_error: "Le kilométrage est requis."}).int().min(0, "Le kilométrage doit être positif."),
  carburantNiveauDepart: z.number().min(0).max(1),
  roueSecours: z.boolean().default(false),
  posteRadio: z.boolean().default(false),
  lavage: z.boolean().default(false),
  cric: z.boolean().default(false),
  giletTriangle: z.boolean().default(false),
  doubleCles: z.boolean().default(false),
  dommagesDepartNotes: z.string().optional(),
  dommagesDepart: z.record(z.string(), damageTypeEnum).optional(),
  photosDepart: z.array(z.object({ url: z.string().url("Veuillez entrer une URL valide.").or(z.literal('')) })).optional(),
  
  kilometrageRetour: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).positive("Le kilométrage de retour doit être un nombre positif.").optional()
  ),
  carburantNiveauRetour: z.number().min(0).max(1).optional(),
  roueSecoursRetour: z.boolean().default(true).optional(),
  posteRadioRetour: z.boolean().default(true).optional(),
  lavageRetour: z.boolean().default(true).optional(),
  cricRetour: z.boolean().default(true).optional(),
  giletTriangleRetour: z.boolean().default(true).optional(),
  doubleClesRetour: z.boolean().default(true).optional(),
  dommagesRetourNotes: z.string().optional(),
  dommagesRetour: z.record(z.string(), damageTypeEnum).optional(),
  photosRetour: z.array(z.object({ url: z.string().url("Veuillez entrer une URL valide.").or(z.literal('')) })).optional(),
  dateRetour: z.coerce.date().optional(),
});

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

type RentalFormProps = {
    rental: Rental | null,
    clients: Client[],
    cars: CarType[],
    rentals: Rental[],
    onFinished: () => void,
    mode: 'new' | 'edit' | 'check-in'
};

export default function RentalForm({ rental, clients, cars, rentals, onFinished, mode }: RentalFormProps) {
  const { toast } = useToast();
  const { firestore, auth } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = React.useState(mode !== 'new');
  
  const [newlyCreatedRental, setNewlyCreatedRental] = React.useState<Rental | null>(null);
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);


  const rentalFormSchema = React.useMemo(() => {
    if (mode === 'check-in') {
        return baseSchema.extend({
            kilometrageRetour: z.coerce.number({
                required_error: "Le kilométrage de retour est requis.",
                invalid_type_error: "Veuillez entrer un nombre valide.",
            }).int().positive("Le kilométrage de retour doit être un nombre positif."),
            dateRetour: z.coerce.date({
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
      lieuDepart: "Agence",
      lieuRetour: "Agence",
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
      cric: true,
      giletTriangle: true,
      doubleCles: true,
      dateRetour: new Date(),
      roueSecoursRetour: true,
      posteRadioRetour: true,
      lavageRetour: true,
      cricRetour: true,
      giletTriangleRetour: true,
      doubleClesRetour: true,
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
                   cric: insp.cric,
                   giletTriangle: insp.giletTriangle,
                   doubleCles: insp.doubleCles,
                   dommagesNotes: insp.dommagesNotes,
                   damages: insp.damages,
                   photos: insp.photos || []
               }
            }
        } else if (rental.livraison) {
            livraisonData = rental.livraison; 
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
                   cric: insp.cric,
                   giletTriangle: insp.giletTriangle,
                   doubleCles: insp.doubleCles,
                   dommagesNotes: insp.notes,
                   damages: insp.damages,
                   photos: insp.photos || []
                }
             }
        } else if (mode === 'check-in' && rental.reception) {
            receptionData = rental.reception;
        }

        const defaults = {
            clientId: rentalClient?.id ?? "",
            conducteur2_clientId: rentalConducteur2?.id ?? '_none_',
            voitureId: rental.vehicule.carId,
            dateRange: { from: getSafeDate(rental.location.dateDebut)!, to: getSafeDate(rental.location.dateFin)! },
            lieuDepart: rental.location.lieuDepart || "Agence",
            lieuRetour: rental.location.lieuRetour || "Agence",
            caution: rental.location.depot,
            
            kilometrageDepart: livraisonData?.kilometrage,
            carburantNiveauDepart: livraisonData?.carburantNiveau,
            roueSecours: livraisonData?.roueSecours,
            posteRadio: livraisonData?.posteRadio,
            lavage: livraisonData?.lavage,
            cric: livraisonData?.cric,
            giletTriangle: livraisonData?.giletTriangle,
            doubleCles: livraisonData?.doubleCles,
            dommagesDepartNotes: livraisonData?.dommagesNotes || "",
            dommagesDepart: livraisonData?.damages || {},
            photosDepart: (livraisonData?.photos || []).map((p: string) => ({url: p})),

            kilometrageRetour: receptionData?.kilometrage,
            carburantNiveauRetour: receptionData?.carburantNiveau,
            roueSecoursRetour: receptionData?.roueSecours ?? true,
            posteRadioRetour: receptionData?.posteRadio ?? true,
            lavageRetour: receptionData?.lavage ?? true,
            cricRetour: receptionData?.cric ?? true,
            giletTriangleRetour: receptionData?.giletTriangle ?? true,
            doubleClesRetour: receptionData?.doubleCles ?? true,
            dommagesRetourNotes: receptionData?.dommagesNotes || "",
            dommagesRetour: receptionData?.damages || (mode === 'check-in' ? livraisonData?.damages : {}) || {},
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
  }, [rental, mode, firestore, clients]);
  
  const { setValue } = form;
  const selectedClientId = form.watch("clientId");
  const selectedCarId = form.watch("voitureId");
  const dateRange = form.watch("dateRange");
  const dateRetour = form.watch("dateRetour");

  const availableClients = React.useMemo(() => {
    if (mode !== 'new') return clients;
    const busyClientCins = new Set<string>();
    rentals.forEach(r => {
      if (r.statut === 'en_cours') {
        busyClientCins.add(r.locataire.cin);
        if (r.conducteur2?.cin) {
          busyClientCins.add(r.conducteur2.cin);
        }
      }
    });
    return clients.filter(c => !busyClientCins.has(c.cin));
  }, [clients, rentals, mode]);

  React.useEffect(() => {
    if (selectedCarId && mode === 'new') {
      const selectedCar = cars.find(c => c.id === selectedCarId);
      if (selectedCar) {
        setValue('kilometrageDepart', selectedCar.kilometrage, { shouldValidate: true });
      }
    }
  }, [selectedCarId, cars, mode, setValue]);

  const availableCars = React.useMemo(() => {
    return cars.filter(car => {
        const isBaseAvailable = car.disponibilite === 'disponible' || (rental && car.id === rental.vehicule.carId);
        if (!isBaseAvailable) return false;
        if (car.maintenanceSchedule) {
            const km = car.kilometrage;
            const s = car.maintenanceSchedule;
            const isMaintenanceOverdue = (
                (s.prochainVidangeKm && km >= s.prochainVidangeKm) ||
                (s.prochainFiltreGasoilKm && km >= s.prochainFiltreGasoilKm) ||
                (s.prochainesPlaquettesFreinKm && km >= s.prochainesPlaquettesFreinKm) ||
                (s.prochaineCourroieDistributionKm && km >= s.prochaineCourroieDistributionKm)
            );
            if (isMaintenanceOverdue) return false;
        }
        return true;
    });
  }, [cars, rental]);

  const selectedCarForUI = React.useMemo(() => {
    return cars.find(car => car.id === selectedCarId);
  }, [selectedCarId, cars]);

  const rentalDaysForUI = React.useMemo(() => {
    const from = (mode === 'check-in' && rental) ? getSafeDate(rental.location.dateDebut) : dateRange?.from;
    const to = (mode === 'check-in' && rental) ? dateRetour : dateRange?.to;

    if (from && to) {
        if (startOfDay(from).getTime() === startOfDay(to).getTime()) {
            return 1;
        }
        const daysDiff = differenceInCalendarDays(to, from);
        return daysDiff > 0 ? daysDiff : 1;
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
      const firstErrorKey = Object.keys(errors)[0];
      const firstErrorMessage = errors[firstErrorKey]?.message || (Array.isArray(errors[firstErrorKey]) ? errors[firstErrorKey][0]?.url?.message : "Erreur de validation");
      toast({
          variant: "destructive",
          title: "Erreur de validation",
          description: firstErrorMessage || "Veuillez corriger les erreurs en surbrillance.",
      });
    }
  };

  async function onSubmit(data: z.infer<typeof rentalFormSchema>) {
    if (!firestore || !auth.currentUser) return;
    setIsSubmitting(true);
    const userId = auth.currentUser.uid;
    
    const handleInspectionInBatch = (
        rentalId: string, 
        carId: string, 
        type: 'depart' | 'retour',
        inspectionData: any,
        batch: import("firebase/firestore").WriteBatch
    ) => {
        const inspectionRef = doc(collection(firestore, 'inspections'));
        const photosArray = type === 'depart' ? inspectionData.photosDepart : inspectionData.photosRetour;
        const photoUrls = photosArray ? photosArray.map((item: {url:string}) => item.url.trim()).filter((url: string) => url) : [];

        const inspectionPayload: Omit<Inspection, 'id' | 'damages'> = {
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
            cric: type === 'depart' ? inspectionData.cric : inspectionData.cricRetour,
            giletTriangle: type === 'depart' ? inspectionData.giletTriangle : inspectionData.giletTriangleRetour,
            doubleCles: type === 'depart' ? inspectionData.doubleCles : inspectionData.doubleClesRetour,
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
        if (mode === 'check-in' && rental) {
            const rentalRef = doc(firestore, 'rentals', rental.id);
            const archivedRentalRef = doc(firestore, 'archived_rentals', rental.id);
            const carDocRef = doc(firestore, 'cars', rental.vehicule.carId);
            const receptionInspectionRef = doc(collection(firestore, 'inspections'));
            
            await runTransaction(firestore, async (transaction) => {
                // READ FIRST
                const rentalDoc = await transaction.get(rentalRef);
                if (!rentalDoc.exists()) throw new Error("Contrat de location introuvable.");

                // WRITES AFTER
                const receptionInspectionId = receptionInspectionRef.id;
                const photoUrls = data.photosRetour ? data.photosRetour.map((item: { url: string }) => item.url.trim()).filter((url: string) => url) : [];
                const inspectionPayload: Omit<Inspection, 'id' | 'damages'> = {
                    vehicleId: rental.vehicule.carId,
                    rentalId: rental.id,
                    userId: userId,
                    timestamp: data.dateRetour,
                    type: 'retour',
                    notes: data.dommagesRetourNotes,
                    kilometrage: data.kilometrageRetour!,
                    carburantNiveau: data.carburantNiveauRetour!,
                    roueSecours: data.roueSecoursRetour!,
                    posteRadio: data.posteRadioRetour!,
                    lavage: data.lavageRetour!,
                    cric: data.cricRetour!,
                    giletTriangle: data.giletTriangleRetour!,
                    doubleCles: data.doubleClesRetour!,
                    photos: photoUrls,
                };
                transaction.set(receptionInspectionRef, inspectionPayload);

                const damages = data.dommagesRetour;
                if (damages) {
                    for (const partId of Object.keys(damages)) {
                        const damageType = damages[partId as keyof typeof damages];
                        if (!damageType) continue;
                        const partInfo = carParts.find(p => p.id === partId);
                        const damageDocRef = doc(collection(firestore, `inspections/${receptionInspectionId}/damages`));
                        const damagePayload: Omit<Damage, 'id'> = {
                            partName: partId,
                            damageType: damageType,
                            positionX: partInfo?.x || 0,
                            positionY: partInfo?.y || 0,
                        };
                        transaction.set(damageDocRef, damagePayload);
                    }
                }

                const finalRentalDays = rentalDaysForUI;
                const finalAmountToPay = finalRentalDays * rental.location.prixParJour;
                
                transaction.update(rentalRef, {
                    receptionInspectionId: receptionInspectionId,
                    'location.dateFin': data.dateRetour,
                    'location.lieuRetour': data.lieuRetour,
                    'location.nbrJours': finalRentalDays,
                    'location.montantTotal': finalAmountToPay,
                    statut: 'terminee',
                });
                
                transaction.set(archivedRentalRef, {
                    receptionInspectionId: receptionInspectionId,
                    'location.dateFin': data.dateRetour,
                    'location.lieuRetour': data.lieuRetour,
                    'location.nbrJours': finalRentalDays,
                    'location.montantTotal': finalAmountToPay,
                    statut: 'terminee',
                }, { merge: true });

                transaction.update(carDocRef, { kilometrage: data.kilometrageRetour, disponibilite: 'disponible' });
            });

            toast({ title: "Location terminée", description: `La réception pour ${rental.locataire.nomPrenom} a été enregistrée.` });
            onFinished();

        } else if (mode === 'edit' && rental) {
            const { dateRange, lieuRetour } = data;
            const rentalRef = doc(firestore, 'rentals', rental.id);
            const archivedRentalRef = doc(firestore, 'archived_rentals', rental.id);

            const dayDiff = differenceInCalendarDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
            const finalRentalDays = dayDiff >= 1 ? dayDiff : 1;
            const finalAmountToPay = finalRentalDays * rental.location.prixParJour;

            const updateData = {
                'location.dateFin': dateRange.to,
                'location.lieuRetour': lieuRetour || "Agence",
                'location.nbrJours': finalRentalDays,
                'location.montantTotal': finalAmountToPay,
            };

            // First, outside transaction, resolve which archived doc to update
            const q = query(collection(firestore, 'archived_rentals'), where('contractNumber', '==', rental.contractNumber));
            const qSnap = await getDocs(q);
            const targetArchiveRef = !qSnap.empty ? qSnap.docs[0].ref : archivedRentalRef;

            // Use runTransaction to ensure sync between both collections
            await runTransaction(firestore, async (transaction) => {
                // Perform writes (blind updates are fine here since we have refs)
                transaction.update(rentalRef, updateData);
                transaction.set(targetArchiveRef, updateData, { merge: true });
            });
            
            toast({ title: "Contrat mis à jour", description: "Les modifications ont été synchronisées partout." });
            
            const updatedRental: Rental = {
                ...rental,
                location: {
                    ...rental.location,
                    dateFin: dateRange.to,
                    lieuRetour: lieuRetour || "Agence",
                    nbrJours: finalRentalDays,
                    montantTotal: finalAmountToPay,
                }
            };
            setNewlyCreatedRental(updatedRental);
            setShowPaymentForm(true);

        } else { 
            const batch = writeBatch(firestore);
            const { voitureId, clientId, conducteur2_clientId, dateRange, caution, lieuDepart, lieuRetour } = data;

            const selectedCar = cars.find(c => c.id === voitureId);
            const selectedClient = clients.find(c => c.id === clientId);
            const selectedConducteur2 = (conducteur2_clientId && conducteur2_clientId !== '_none_') ? clients.find(c => c.id === conducteur2_clientId) : null;

            if (!selectedCar || !selectedClient) throw new Error("Client ou voiture invalides.");

            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const prefix = `C-${year}-${month}-`;

            const getNextSeqForCollection = async (collectionPath: string) => {
                const rentalsRef = collection(firestore, collectionPath);
                const q = query(rentalsRef, where("contractNumber", ">=", prefix), where("contractNumber", "<", prefix + '\uf8ff'), orderBy("contractNumber", "desc"), limit(1));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) return 0;
                const lastContractNumber = querySnapshot.docs[0].data().contractNumber;
                return parseInt(lastContractNumber.split('-').pop() || '0', 10);
            };

            const [seqActive, seqArchived] = await Promise.all([getNextSeqForCollection("rentals"), getNextSeqForCollection("archived_rentals")]);
            const nextSeq = Math.max(seqActive, seqArchived) + 1;
            const newContractNumber = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
            
            const dayDiff = differenceInCalendarDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
            const rentalDays = dayDiff > 0 ? dayDiff : 1;
            const totalAmount = rentalDays * selectedCar.prixParJour;
            const safeDateMiseEnCirculation = timestampToDate(selectedCar.dateMiseEnCirculation);
            const newRentalRef = doc(collection(firestore, 'rentals'));
            const livraisonInspectionId = handleInspectionInBatch(newRentalRef.id, selectedCar.id, 'depart', data, batch);
            const carRef = doc(firestore, 'cars', selectedCar.id);

            const rentalPayload: Omit<Rental, 'id'> & {createdAt: any} = {
                contractNumber: newContractNumber,
                locataire: {
                    cin: selectedClient.cin,
                    nomPrenom: selectedClient.nom,
                    permisNo: selectedClient.nom,
                    telephone: selectedClient.telephone,
                },
                ...(selectedConducteur2 && {
                    conducteur2: {
                        nomPrenom: selectedConducteur2.nom,
                        cin: selectedConducteur2.cin,
                        permisNo: selectedConducteur2.permisNo || 'N/A',
                        permisDateDelivrance: selectedConducteur2.permisDateDelivrance,
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
                    lieuDepart: lieuDepart || 'Agence',
                    lieuRetour: lieuRetour || 'Agence',
                    prixParJour: selectedCar.prixParJour,
                    nbrJours: rentalDays,
                    depot: caution || 0,
                    montantTotal: totalAmount,
                    montantPaye: 0,
                },
                statut: 'en_cours' as 'en_cours',
                createdAt: serverTimestamp(),
            };
            
            batch.set(newRentalRef, rentalPayload);
            const newArchivedRentalRef = doc(firestore, 'archived_rentals', newRentalRef.id);
            batch.set(newArchivedRentalRef, rentalPayload);
            batch.update(carRef, { disponibilite: 'louee' });
            
            await batch.commit();
            toast({ title: "Contrat créé", description: `Le contrat pour ${selectedClient.nom} a été créé avec succès.` });
            
            const tempRentalForUI: Rental = { id: newRentalRef.id, ...rentalPayload, createdAt: Timestamp.now() };
            setNewlyCreatedRental(tempRentalForUI);
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
  const buttonText = { new: 'Créer le contrat', edit: 'Enregistrer les modifications', 'check-in': 'Terminer et Réceptionner le Véhicule' };

  if (isLoadingDefaults) {
    return (
        <div className="space-y-4 mt-4">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-10 w-full" />
        </div>
    );
  }
  
  if (showPaymentForm && newlyCreatedRental) {
    const rentalsForPayment = [newlyCreatedRental, ...rentals.filter(r => r.id !== newlyCreatedRental!.id)];
    return (
        <div className="mt-4">
            <h4 className="text-lg font-semibold mb-1">Paiement</h4>
            <p className="text-sm text-muted-foreground mb-4">pour le contrat N° {newlyCreatedRental.contractNumber}</p>
            <PaymentForm payment={null} rentals={rentalsForPayment} onFinished={() => { setNewlyCreatedRental(null); setShowPaymentForm(false); onFinished(); }} preselectedRentalId={newlyCreatedRental.id} />
        </div>
    );
  }

  if (newlyCreatedRental) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 mt-8">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold">{mode === 'edit' ? "Contrat mis à jour !" : "Contrat enregistré !"}</h3>
              <p className="text-muted-foreground mt-2 mb-6">Le contrat N° {newlyCreatedRental.contractNumber} pour {newlyCreatedRental.locataire.nomPrenom} a été enregistré.</p>
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <Button onClick={() => setShowPaymentForm(true)} className="w-full"><DollarSign className="mr-2" />Encaisser le paiement</Button>
                  <Button variant="outline" onClick={onFinished} className="w-full">Fermer</Button>
              </div>
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
                    <FormField control={form.control} name="clientId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={mode !== 'new'}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger></FormControl>
                            <SelectContent>{availableClients.map(client => <SelectItem key={client.id} value={client.id}>{client.nom} ({client.cin})</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    <FormField control={form.control} name="conducteur2_clientId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deuxième conducteur (Optionnel)</FormLabel>
                           <Select onValueChange={field.onChange} value={field.value || '_none_'} disabled={mode !== 'new'}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un deuxième conducteur" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="_none_">Aucun</SelectItem>{availableClients.filter(client => client.id !== selectedClientId).map(client => (<SelectItem key={client.id} value={client.id}>{client.nom} ({client.cin})</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    <FormField control={form.control} name="voitureId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voiture</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={mode !== 'new'}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une voiture" /></SelectTrigger></FormControl>
                            <SelectContent>{availableCars.map(car => <SelectItem key={car.id} value={car.id}>{car.marque} {car.modele} ({car.immat})</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    <FormField control={form.control} name="dateRange" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Période de location</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl><Button variant={"outline"} disabled={mode === 'check-in'} className={cn("w-full pl-3 text-left font-normal", !field.value?.from && "text-muted-foreground")}>{field.value?.from ? (field.value.to ? (<>{format(field.value.from, "dd LLL, y", { locale: fr })} - {format(field.value.to, "dd LLL, y", { locale: fr })}</>) : (format(field.value.from, "dd LLL, y", { locale: fr }))) : (<span>Choisir une plage de dates</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={field.value?.from} selected={{from: field.value?.from, to: field.value?.to}} onSelect={field.onChange} numberOfMonths={2} locale={fr} disabled={date => mode === 'new' ? date < new Date(new Date().setHours(0,0,0,0)) : false} captionLayout="dropdown-nav" fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 5} /></PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="lieuDepart" render={({ field }) => (<FormItem><FormLabel>Départ</FormLabel><FormControl><Input placeholder="Agence" {...field} value={field.value ?? ''} readOnly={mode !== 'new'} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="lieuRetour" render={({ field }) => (<FormItem><FormLabel>Retour</FormLabel><FormControl><Input placeholder="Agence" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                    </div>
                     <FormField control={form.control} name="caution" render={({ field }) => (<FormItem><FormLabel>Caution (MAD)</FormLabel><FormControl><Input type="number" placeholder="5000" {...field} value={field.value ?? ''} readOnly={mode !== 'new'} /></FormControl></FormItem>)} />
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger>Livraison (Départ)</AccordionTrigger>
                <AccordionContent className="space-y-4 px-1">
                     <FormField control={form.control} name="kilometrageDepart" render={({ field }) => (<FormItem><FormLabel>Kilométrage</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} readOnly /></FormControl></FormItem>)} />
                     <FormField control={form.control} name="carburantNiveauDepart" render={({ field }) => (<FormItem><FormLabel>Niveau carburant: {Math.round((field.value || 0) * 100)}%</FormLabel><FormControl><Slider value={[field.value || 0]} onValueChange={(values) => field.onChange(values[0])} max={1} step={0.125} disabled={mode !== 'new'} /></FormControl></FormItem>)} />
                    <div><FormLabel>Equipements</FormLabel><div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2"><FormField control={form.control} name="roueSecours" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} /></FormControl><FormLabel className="font-normal">Roue de secours</FormLabel></FormItem>)} /><FormField control={form.control} name="posteRadio" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} /></FormControl><FormLabel className="font-normal">Poste Radio</FormLabel></FormItem>)} /><FormField control={form.control} name="lavage" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} /></FormControl><FormLabel className="font-normal">Voiture propre</FormLabel></FormItem>)} /><FormField control={form.control} name="cric" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} /></FormControl><FormLabel className="font-normal">Cric et manivelle</FormLabel></FormItem>)} /><FormField control={form.control} name="giletTriangle" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} /></FormControl><FormLabel className="font-normal">Gilet et triangle</FormLabel></FormItem>)} /><FormField control={form.control} name="doubleCles" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={mode !== 'new'} /></FormControl><FormLabel className="font-normal">Double des clés</FormLabel></FormItem>)} /></div></div>
                    <div><FormField control={form.control} name="dommagesDepart" render={({ field }) => (<FormItem><FormLabel>Dommages (Départ)</FormLabel><FormControl><CarDamageDiagram damages={field.value || {}} onDamagesChange={field.onChange} readOnly={mode !== 'new'} /></FormControl></FormItem>)} /></div>
                     <FormField control={form.control} name="dommagesDepartNotes" render={({ field }) => (<FormItem><FormLabel>Notes (Départ)</FormLabel><FormControl><Textarea placeholder="Notes..." {...field} value={field.value ?? ''} readOnly={mode !== 'new'} /></FormControl></FormItem>)} />
                </AccordionContent>
            </AccordionItem>
            {mode === 'check-in' && rental && (
              <AccordionItem value="item-3">
                  <AccordionTrigger>Réception (Retour)</AccordionTrigger>
                  <AccordionContent className="space-y-4 px-1">
                      <FormField control={form.control} name="dateRetour" render={({ field }) => (<FormItem><FormLabel>Date de retour</FormLabel><FormControl><Input type="date" value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""} onChange={(e) => field.onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name="kilometrageRetour" render={({ field }) => (<FormItem><FormLabel>Kilométrage</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name="carburantNiveauRetour" render={({ field }) => (<FormItem><FormLabel>Niveau carburant: {field.value ? Math.round(field.value * 100) : 0}%</FormLabel><FormControl><Slider value={[field.value || 0]} onValueChange={(values) => field.onChange(values[0])} max={1} step={0.125} /></FormControl></FormItem>)} />
                       <div><FormLabel>Equipements (Retour)</FormLabel><div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2"><FormField control={form.control} name="roueSecoursRetour" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Roue de secours</FormLabel></FormItem>)} /><FormField control={form.control} name="posteRadioRetour" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Poste Radio</FormLabel></FormItem>)} /><FormField control={form.control} name="lavageRetour" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Voiture propre</FormLabel></FormItem>)} /><FormField control={form.control} name="cricRetour" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Cric et manivelle</FormLabel></FormItem>)} /><FormField control={form.control} name="giletTriangleRetour" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Gilet et triangle</FormLabel></FormItem>)} /><FormField control={form.control} name="doubleClesRetour" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Double des clés</FormLabel></FormItem>)} /></div></div>
                      <div><FormField control={form.control} name="dommagesRetour" render={({ field }) => (<FormItem><FormLabel>Dommages (Retour)</FormLabel><FormControl><CarDamageDiagram damages={field.value || {}} onDamagesChange={field.onChange} /></FormControl></FormItem>)} /></div>
                      <FormField control={form.control} name="dommagesRetourNotes" render={({ field }) => (<FormItem><FormLabel>Notes (Retour)</FormLabel><FormControl><Textarea placeholder="Notes..." {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                  </AccordionContent>
              </AccordionItem>
            )}
        </Accordion>
        <Card className="bg-muted/50"><CardHeader><CardTitle className="text-lg">Résumé</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Prix par jour :</span> <span className="font-medium">{formatCurrency(displayPricePerDay, 'MAD')}</span></div><div className="flex justify-between"><span>Durée :</span> <span className="font-medium">{rentalDaysForUI} jour(s)</span></div><div className="flex justify-between font-semibold"><span>Montant Total :</span> <span>{formatCurrency(prixTotalForUI, 'MAD')}</span></div>{mode !== 'new' && rental && (<><div className="flex justify-between text-green-600"><span>Payé :</span> <span className="font-medium">{formatCurrency(rental.location.montantPaye || 0, 'MAD')}</span></div><div className="flex justify-between font-bold text-lg text-destructive"><span>Reste :</span> <span>{formatCurrency(prixTotalForUI - (rental.location.montantPaye || 0), 'MAD')}</span></div></>)}</CardContent></Card>
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>{isSubmitting ? "Enregistrement..." : buttonText[mode]}</Button>
      </form>
    </Form>
  );
}
