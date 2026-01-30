"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Car, Maintenance } from "@/lib/definitions";
import { useFirebase } from "@/firebase";
import { arrayUnion, doc, serverTimestamp, updateDoc, FieldValue } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import React from "react";
import { maintenanceInterventionTypes } from "@/lib/car-data";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { format } from 'date-fns';

const startMaintenanceSchema = z.object({
  reason: z.string().min(3, "La raison est requise."),
  notes: z.string().optional(),
});

const finishMaintenanceSchema = z.object({
  addToHistory: z.boolean().default(false),
  maintenanceEvent: z.object({
    date: z.coerce.date(),
    kilometrage: z.coerce.number().int().min(0, "Le kilométrage doit être positif."),
    typeIntervention: z.string(),
    description: z.string().min(3, "La description est requise."),
    cout: z.coerce.number().min(0).optional().nullable(),
  }).optional(),
}).refine(data => {
    if (data.addToHistory) {
        return data.maintenanceEvent && data.maintenanceEvent.kilometrage > 0 && data.maintenanceEvent.description.length > 0;
    }
    return true;
}, {
    message: "Le kilométrage et la description sont requis pour ajouter à l'historique.",
    path: ["maintenanceEvent"],
});


export default function MaintenanceForm({ car, onFinished }: { car: Car, onFinished: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const isFinishing = car.disponibilite === 'maintenance';

  const form = useForm({
    resolver: zodResolver(isFinishing ? finishMaintenanceSchema : startMaintenanceSchema),
    defaultValues: isFinishing ? {
      addToHistory: true,
      maintenanceEvent: {
        date: car.currentMaintenance?.startDate?.toDate() || new Date(),
        kilometrage: car.kilometrage,
        typeIntervention: car.currentMaintenance?.reason || "",
        description: car.currentMaintenance?.notes || "",
        cout: undefined
      }
    } : {
      reason: "",
      notes: ""
    }
  });
  
  const addToHistory = form.watch("addToHistory");

  const onSubmit = async (data: any) => {
    if (!firestore) return;
    setIsSubmitting(true);
    
    const carRef = doc(firestore, 'cars', car.id);

    try {
        if (isFinishing) {
            const updatePayload: any = {
                disponibilite: 'disponible',
                currentMaintenance: null
            };

            if (data.addToHistory && data.maintenanceEvent) {
                const newHistoryEvent: Maintenance = {
                    ...data.maintenanceEvent
                };
                updatePayload.maintenanceHistory = arrayUnion(newHistoryEvent);
            }
            await updateDoc(carRef, updatePayload);
            toast({ title: "Maintenance terminée", description: "La voiture est de nouveau marquée comme disponible." });

        } else { // Starting maintenance
            const updatePayload = {
                disponibilite: 'maintenance',
                currentMaintenance: {
                    startDate: serverTimestamp(),
                    reason: data.reason,
                    notes: data.notes || ""
                }
            };
            await updateDoc(carRef, updatePayload);
            toast({ title: "Voiture en maintenance", description: "Le statut de la voiture a été mis à jour." });
        }
        onFinished();
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: carRef.path,
            operation: 'update',
        }, serverError as Error));
        toast({
            variant: "destructive",
            title: "Une erreur est survenue",
            description: "Impossible de mettre à jour le statut de la voiture.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        {isFinishing ? (
            <div className="space-y-4">
                <div className="p-4 border rounded-md bg-muted/50">
                    <h4 className="font-semibold">Terminer la maintenance</h4>
                    <p className="text-sm text-muted-foreground">
                        La voiture est en maintenance depuis le {car.currentMaintenance?.startDate ? format(car.currentMaintenance.startDate.toDate(), 'dd/MM/yyyy') : 'N/A'}.<br/>
                        Raison: <strong>{car.currentMaintenance?.reason}</strong>
                    </p>
                </div>
                <FormField
                    control={form.control}
                    name="addToHistory"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>Ajouter cette intervention à l'historique d'entretien</FormLabel>
                                <FormDescription>Ceci créera une nouvelle entrée dans l'historique d'entretien du véhicule.</FormDescription>
                            </div>
                        </FormItem>
                    )}
                />

                {addToHistory && (
                    <div className="p-4 border rounded-md space-y-4">
                        <h4 className="font-semibold">Détails de l'intervention</h4>
                        <FormField
                            control={form.control}
                            name="maintenanceEvent.kilometrage"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Kilométrage actuel</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="maintenanceEvent.description"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description des travaux effectués</FormLabel>
                                <FormControl><Textarea placeholder="Ex: Remplacement des plaquettes de frein avant..." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="maintenanceEvent.cout"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Coût de l'intervention (MAD)</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                )}

            </div>
        ) : (
            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Raison de la maintenance</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner un type d'intervention" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Object.entries(maintenanceInterventionTypes).map(([group, options]) => (
                                    <SelectGroup key={group}>
                                    <SelectLabel>{group}</SelectLabel>
                                    {options.map((option) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
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
                    name="notes"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Notes supplémentaires</FormLabel>
                        <FormControl><Textarea placeholder="Symptômes observés, détails spécifiques..." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
        )}

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (isFinishing ? 'Terminer la maintenance' : 'Mettre en maintenance')}
        </Button>
      </form>
    </Form>
  );
}
