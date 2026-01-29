import React from 'react';
import type { Payment } from '@/lib/definitions';
import { Logo } from '../logo';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type InvoiceProps = {
    payment: Payment;
};

export const Invoice: React.FC<InvoiceProps> = ({ payment }) => {
    if (!payment) return null;

    const safePaymentDate = payment.paymentDate?.toDate ? format(payment.paymentDate.toDate(), "dd/MM/yyyy", { locale: fr }) : 'N/A';

    const amountInWords = `${payment.amount.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Dirhams`;

    return (
        <div id="printable-invoice" className="p-4 border rounded-md font-sans text-sm bg-white text-black">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <Logo />
                    <div>
                        <h2 className="font-bold text-lg">Location Auto Pro</h2>
                        <p className="text-xs">
                            Agdal, Rabat, Maroc<br/>
                            Tél: +212 537 00 00 00
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="font-bold text-xl uppercase">Facture</h1>
                    <p>N°: {payment.id.substring(0, 8).toUpperCase()}</p>
                    <p>Date: {safePaymentDate}</p>
                </div>
            </div>

            <div className="space-y-4 my-8">
                 <p>
                    <span className="font-semibold">Facturé à :</span> {payment.clientName}
                </p>
                <p>
                    <span className="font-semibold">Montant payé :</span> {amountInWords} ({formatCurrency(payment.amount, 'MAD')}).
                </p>
                <p>
                    <span className="font-semibold">Description :</span> Paiement pour la location (Contrat N° {payment.rentalId.substring(0, 8).toUpperCase()})
                </p>
                 <p>
                    <span className="font-semibold">Mode de paiement :</span> {payment.paymentMethod}
                </p>
            </div>

            <div className="mt-16 flex justify-end">
                <div className="text-center w-1/2">
                     <p className="border-t pt-2 border-gray-400">Cachet et Signature de l'agence</p>
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-gray-500">
                 RC: 123456 | IF: 78901234 | ICE: 567890123456789
            </div>
        </div>
    );
};
