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
    
    // A simple (and not 100% accurate) way to convert number to words for demonstration
    // In a real app, a proper library should be used.
    const numberToWords = (num: number) => {
        // This is a placeholder. A real implementation is complex.
        return `${num.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Dirhams`;
    };

    const amountInWords = numberToWords(payment.amount);

    return (
        <div id="printable-invoice" className="p-8 font-sans text-sm bg-white text-black min-h-[280mm] flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-start pb-8 border-b">
                <div className="flex items-center gap-4">
                    <Logo />
                    <div>
                        <h2 className="font-bold text-xl">Location Auto Pro</h2>
                        <p className="text-xs text-gray-600">
                            123 Rue de la Liberté, Agdal<br/>
                            Rabat, Maroc<br/>
                            Tél: +212 537 00 00 00
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="font-bold text-3xl uppercase text-gray-800">Facture</h1>
                    <p className="text-gray-600">N°: <span className="font-mono">{payment.id.substring(0, 8).toUpperCase()}</span></p>
                    <p className="text-gray-600">Date: {safePaymentDate}</p>
                </div>
            </header>

            {/* Client Info */}
            <section className="my-10">
                <h3 className="font-semibold text-gray-800 mb-2">Facturé à :</h3>
                <p className="text-lg font-medium">{payment.clientName}</p>
            </section>

            {/* Invoice Body */}
            <section className="flex-grow">
                 <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-100" style={{printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'}}>
                            <th className="p-3 font-semibold">Description</th>
                            <th className="p-3 font-semibold text-right">Montant</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b">
                            <td className="p-3">
                                <p>Paiement pour la location de véhicule.</p>
                                <p className="text-xs text-gray-500">Référence Contrat: {payment.rentalId.substring(0, 8).toUpperCase()}</p>
                                <p className="text-xs text-gray-500">Mode de paiement: {payment.paymentMethod}</p>
                            </td>
                            <td className="p-3 text-right font-medium">{formatCurrency(payment.amount, 'MAD')}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-8 flex justify-end">
                    <div className="w-full max-w-xs">
                        <div className="flex justify-between text-lg font-semibold py-2 border-b">
                            <span>Total : </span>
                            <span>{formatCurrency(payment.amount, 'MAD')}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-auto pt-8 border-t text-sm text-gray-700">
                 <p className="mb-8">
                    Arrêtée la présente facture à la somme de : <span className="font-semibold">{amountInWords}</span>.
                </p>
                <div className="flex justify-between items-end">
                     <div className="text-center">
                        {/* Placeholder for signature */}
                    </div>
                    <div className="text-center w-1/3">
                        <p className="pt-2">Cachet et Signature de l'agence</p>
                        <div className="mt-16 border-t border-gray-400"></div>
                    </div>
                </div>
                <div className="mt-12 text-center text-xs text-gray-500">
                    RC: 123456 | IF: 78901234 | ICE: 567890123456789
                </div>
            </footer>
        </div>
    );
};
