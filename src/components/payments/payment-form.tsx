
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
import type { Payment, Rental } from "@/lib/definitions";
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import React from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";

const paymentFormSchema = z.object({
  rentalId: z.string().min(1, "Veuillez sélectionner un contrat de location."),
  amount: z.coerce.number().positive("Le montant doit être un nombre positif."),
  paymentDate: z.coerce.date({ required_error: "La date de paiement est requise." }),
  paymentMethod: z.enum(["Especes", "Carte bancaire", "Virement", "Avance"], { required_error: "La méthode de paiement est requise." }),
  status: z.enum(["complete", "en_attente"], { required_error: "Le statut est requis." }),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;


const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate) return date.toDate(); // Firestore Timestamp
    if (date instanceof Date) return date;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const calculateTotal = (rental: Rental): number => {
    const from = getSafeDate(rental.location.dateDebut);
    const to = getSafeDate(rental.location.dateFin);

    if (from && to && rental.location.prixParJour > 0) {
        const daysDiff = differenceInCalendarDays(startOfDay(to), startOfDay(from));
        const rentalDays = daysDiff < 1 ? 1 : daysDiff;
        return rentalDays * rental.location.prixParJour;
    }
    return rental.location.montantTotal ?? (rental.location.nbrJours || 0) * (rental.location.prixParJour || 0);
};


export default function PaymentForm({ payment, rentals, onFinished, preselectedRentalId }: { 
    payment: Payment | null, 
    rentals: Rental[], 
    onFinished: () => void,
    preselectedRentalId?: string | null
}) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onChange",
  });

  React.useEffect(() => {
    if (payment) {
        form.reset({
            ...payment,
            paymentDate: getSafeDate(payment.paymentDate) ?? new Date(),
        });
        return;
    }

    let defaultAmount: number | undefined = undefined;
    if (preselectedRentalId) {
        const selectedRental = rentals.find(r => r.id === preselectedRentalId);
        if (selectedRental) {
            const total = calculateTotal(selectedRental);
            const paid = selectedRental.location.montantPaye || 0;
            const remaining = total - paid;
            if (remaining > 0) {
                defaultAmount = remaining;
            }
        }
    }

    form.reset({
        rentalId: preselectedRentalId || "",
        amount: defaultAmount,
        paymentDate: new Date(),
        paymentMethod: "Especes" as const,
        status: "complete" as const,
    });
  }, [payment, preselectedRentalId, rentals, form]);

  const selectedRentalId = form.watch("rentalId");
  const selectedRental = React.useMemo(() => {
    return rentals.find(r => r.id === selectedRentalId);
  }, [selectedRentalId, rentals]);

  const financialSummary = React.useMemo(() => {
    if (!selectedRental) return { total: 0, paye: 0, reste: 0 };
    
    const total = calculateTotal(selectedRental);
    const paye = selectedRental.location.montantPaye || 0;
    const reste = total - paye;

    return { total, paye, reste };
  }, [selectedRental]);

  async function onSubmit(data: PaymentFormValues) {
    if (!firestore || !selectedRental) return;
    setIsSubmitting(true);

    const paymentId = payment?.id || doc(collection(firestore, 'payments')).id;
    const isNewPayment = !payment;
    const rentalRef = doc(firestore, 'rentals', selectedRental.id);
    const paymentRef = doc(firestore, 'payments', paymentId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const rentalDoc = await transaction.get(rentalRef);
            if (!rentalDoc.exists()) {
                throw "Contrat de location introuvable.";
            }

            const currentRentalData = rentalDoc.data() as Rental;
            const currentPaidAmount = currentRentalData.location.montantPaye || 0;
            const newPaidAmount = currentPaidAmount + data.amount;

            // 1. Create the payment document payload
            const paymentPayload = {
              ...data,
              clientName: selectedRental.locataire.nomPrenom,
            };
            
            // 2. Set the new payment document
            transaction.set(paymentRef, paymentPayload, { merge: !isNewPayment });

            // 3. Update the rental document
            transaction.update(rentalRef, { 'location.montantPaye': newPaidAmount });
        });

        toast({
          title: isNewPayment ? "Paiement ajouté" : "Paiement mis à jour",
          description: `Le paiement de ${formatCurrency(data.amount, 'MAD')} a été enregistré.`,
        });
        onFinished();
    } catch (error) {
        console.error("Erreur de transaction:", error);
        errorEmitter.emit('permission-error', new Error("Une erreur de permission ou de transaction est survenue."));
        toast({
          variant: "destructive",
          title: "Une erreur est survenue",
          description: typeof error === 'string' ? error : "Impossible de sauvegarder le paiement. Vérifiez vos permissions et réessayez.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="rentalId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contrat de location</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!!payment}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un contrat" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {rentals.map(rental => (
                    <SelectItem key={rental.id} value={rental.id}>
                      {rental.locataire.nomPrenom} - {rental.vehicule.marque} ({rental.id.substring(0, 6).toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRental && (
                <div className="mt-2 text-sm p-3 bg-muted rounded-md border">
                    <p className="font-semibold mb-2">Résumé Financier du Contrat</p>
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span>Total du contrat:</span>
                            <span className="font-medium">{formatCurrency(financialSummary.total, 'MAD')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Montant déjà payé:</span>
                            <span className="font-medium text-green-600">{formatCurrency(financialSummary.paye, 'MAD')}</span>
                        </div>
                         <div className="flex justify-between border-t mt-2 pt-2">
                            <span className="font-semibold">Reste à payer:</span>
                            <span className="font-semibold text-destructive">{formatCurrency(financialSummary.reste, 'MAD')}</span>
                        </div>
                    </div>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Montant (MAD)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="300" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentDate"
          render={({ field }) => (
              <FormItem>
                <FormLabel>Date du paiement</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                    onChange={(e) => field.onChange(e.target.value ? e.target.valueAsDate : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Méthode de paiement</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une méthode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Especes">Espèces</SelectItem>
                  <SelectItem value="Carte bancaire">Carte bancaire</SelectItem>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="Avance">Avance</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Statut</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="complete">Complété</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (payment ? 'Mettre à jour' : 'Ajouter le paiement')}
        </Button>
      </form>
    </Form>
  );
}

    