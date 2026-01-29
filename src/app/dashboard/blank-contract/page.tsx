'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import React from 'react';
import Image from 'next/image';

export default function BlankContractPage() {
  const handlePrint = () => {
    const printStyles = `
      @media print {
        .no-print {
          display: none !important;
        }
        body > *:not(#printable-area) {
          display: none !important;
        }
        #printable-area {
          display: block !important;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
        }
      }
      @page {
        size: A4;
        margin: 15mm;
      }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.id = "print-style-sheet";
    styleSheet.innerHTML = printStyles;
    document.head.appendChild(styleSheet);

    const onAfterPrint = () => {
      styleSheet.remove();
      window.removeEventListener('afterprint', onAfterPrint);
    };

    window.addEventListener('afterprint', onAfterPrint);
    window.print();
  };
  
  const CheckboxItem = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 text-sm">
        <div className="w-3 h-3 border border-gray-400 rounded-sm"></div>
        <span>{label}</span>
    </div>
  );
  
  const sideViewUrl = "https://image.noelshack.com/fichiers/2024/29/1/1721051373-side-view.png";
  const frontViewUrl = "https://image.noelshack.com/fichiers/2024/29/1/1721051373-front-view.png";
  const backViewUrl = "https://image.noelshack.com/fichiers/2024/29/1/1721051373-back-view.png";

  return (
    <div id="printable-area">
      <div className="no-print mb-6 flex justify-between items-center p-4 lg:p-6">
        <h1 className="text-2xl font-bold">Contrat de Location Vierge</h1>
        <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" /> Imprimer le contrat vierge
        </Button>
      </div>

      <div id="blank-contract" className="p-4 bg-white text-black text-xs sm:text-sm md:text-base lg:text-lg shadow-lg rounded-lg border font-sans">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
            <div className="flex items-center gap-3">
                <Logo />
                <div>
                    <h1 className="font-bold text-lg md:text-xl">Car Ghali Pro</h1>
                    <p className="text-xs">123 Rue de la Liberté, Agdal, Rabat</p>
                    <p className="text-xs">Tél: +212 537 00 00 00 | Email: contact@carghalipro.ma</p>
                </div>
            </div>
            <div className="text-right">
                <h2 className="font-bold text-lg md:text-xl">CONTRAT DE LOCATION</h2>
                <p className="text-sm">N°: <span className="inline-block border-b border-dotted border-gray-400 w-24"></span></p>
            </div>
        </header>

        {/* Sections */}
        <div className="space-y-4">
            {/* Locataire & Véhicule */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-300 p-2 rounded-md space-y-2">
                    <div className="space-y-1">
                        <h3 className="font-bold border-b border-gray-300 pb-1 mb-1">LOCATAIRE / CONDUCTEUR 1</h3>
                        <p>Nom & Prénom: <span className="block border-b border-dotted w-full h-4"></span></p>
                        <p>Adresse: <span className="block border-b border-dotted w-full h-4"></span></p>
                        <p>Téléphone: <span className="block border-b border-dotted w-full h-4"></span></p>
                        <p>CIN / Passeport N°: <span className="block border-b border-dotted w-full h-4"></span></p>
                        <p>Permis N°: <span className="block border-b border-dotted w-full h-4"></span> Délivré le: <span className="inline-block border-b border-dotted w-20 h-4"></span></p>
                    </div>
                    <div className="space-y-1 pt-2">
                        <h3 className="font-bold border-b border-gray-300 pb-1 mb-1">CONDUCTEUR 2 (Optionnel)</h3>
                        <p>Nom & Prénom: <span className="block border-b border-dotted w-full h-4"></span></p>
                        <p>CIN / Passeport N°: <span className="block border-b border-dotted w-full h-4"></span></p>
                        <p>Permis N°: <span className="block border-b border-dotted w-full h-4"></span> Délivré le: <span className="inline-block border-b border-dotted w-20 h-4"></span></p>
                    </div>
                </div>
                 <div className="border border-gray-300 p-2 rounded-md space-y-1">
                    <h3 className="font-bold border-b border-gray-300 pb-1 mb-1">VÉHICULE</h3>
                    <p>Marque & Modèle: <span className="block border-b border-dotted w-full h-4"></span></p>
                    <p>Immatriculation: <span className="block border-b border-dotted w-full h-4"></span></p>
                    <p>Couleur: <span className="block border-b border-dotted w-full h-4"></span></p>
                    <p>Date 1ère Circ.: <span className="block border-b border-dotted w-full h-4"></span></p>
                </div>
            </section>
            
            {/* État du Véhicule */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-300 p-2 rounded-md space-y-2">
                    <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">ÉTAT DE DÉPART</h3>
                    <p>Date & Heure: <span className="block border-b border-dotted w-full h-4"></span></p>
                    <p>Kilométrage: <span className="block border-b border-dotted w-full h-4"></span></p>
                    <div>
                        <p>Niveau Carburant:</p>
                        <div className="flex items-center justify-around text-xs mt-1">
                            <span>E</span><div className="w-2 h-4 border-l border-b border-gray-400"></div>
                            <div className="w-4 h-4 border border-gray-400"></div><span>¼</span>
                            <div className="w-4 h-4 border border-gray-400"></div><span>½</span>
                            <div className="w-4 h-4 border border-gray-400"></div><span>¾</span>
                            <div className="w-4 h-4 border border-gray-400"></div>
                            <div className="w-2 h-4 border-r border-b border-gray-400"></div><span>F</span>
                        </div>
                    </div>
                    <div>
                        <p className="font-semibold">Accessoires:</p>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                            <CheckboxItem label="Roue de secours" />
                            <CheckboxItem label="Cric & Manivelle" />
                            <CheckboxItem label="Gilet & Triangle" />
                            <CheckboxItem label="Poste Radio" />
                            <CheckboxItem label="Double des clés" />
                        </div>
                    </div>
                </div>
                 <div className="border border-gray-300 p-2 rounded-md space-y-2">
                    <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">ÉTAT DE RETOUR</h3>
                    <p>Date & Heure: <span className="block border-b border-dotted w-full h-4"></span></p>
                    <p>Kilométrage: <span className="block border-b border-dotted w-full h-4"></span></p>
                     <div>
                        <p>Niveau Carburant:</p>
                        <div className="flex items-center justify-around text-xs mt-1">
                            <span>E</span><div className="w-2 h-4 border-l border-b border-gray-400"></div>
                            <div className="w-4 h-4 border border-gray-400"></div><span>¼</span>
                            <div className="w-4 h-4 border border-gray-400"></div><span>½</span>
                            <div className="w-4 h-4 border border-gray-400"></div><span>¾</span>
                            <div className="w-4 h-4 border border-gray-400"></div>
                            <div className="w-2 h-4 border-r border-b border-gray-400"></div><span>F</span>
                        </div>
                    </div>
                     <div>
                        <p className="font-semibold">Accessoires:</p>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                            <CheckboxItem label="Roue de secours" />
                            <CheckboxItem label="Cric & Manivelle" />
                            <CheckboxItem label="Gilet & Triangle" />
                            <CheckboxItem label="Poste Radio" />
                            <CheckboxItem label="Double des clés" />
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Schémas des dommages */}
            <section className="border border-gray-300 p-2 rounded-md">
                <h3 className="font-bold text-center border-b border-gray-300 pb-1 mb-2">ÉTAT DE LA CARROSSERIE</h3>
                <div className="flex justify-around mb-2 text-xs">
                    <span>Légende:</span>
                    <span><b>R</b> = Rayure</span>
                    <span><b>E</b> = Éclat / Bosse</span>
                    <span><b>C</b> = Cassure</span>
                    <span><b>X</b> = À remplacer</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                    <div className="text-center">
                        <div className="relative w-full h-16">
                            <Image src={sideViewUrl} alt="Côté Gauche" fill className="object-contain" />
                        </div>
                        <p className="text-xs font-semibold mt-1">Côté Gauche</p>
                    </div>
                    <div className="text-center">
                        <div className="relative w-full h-16">
                            <Image src={frontViewUrl} alt="Avant" fill className="object-contain" />
                        </div>
                        <p className="text-xs font-semibold mt-1">Avant</p>
                    </div>
                    <div className="text-center">
                        <div className="relative w-full h-16">
                            <Image src={backViewUrl} alt="Arrière" fill className="object-contain" />
                        </div>
                        <p className="text-xs font-semibold mt-1">Arrière</p>
                    </div>
                    <div className="text-center">
                        <div className="relative w-full h-16">
                            <Image src={sideViewUrl} alt="Côté Droit" fill className="object-contain" style={{ transform: 'scaleX(-1)' }}/>
                        </div>
                        <p className="text-xs font-semibold mt-1">Côté Droit</p>
                    </div>
                </div>
            </section>

             {/* Notes */}
            <section>
                 <p className="font-bold">Observations / Dommages supplémentaires :</p>
                 <div className="border border-gray-300 rounded-md mt-1" style={{ minHeight: '50px' }}></div>
            </section>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t-2 border-black">
             <div className="text-xs text-center mb-6">
                <p>Le locataire reconnaît avoir reçu le véhicule en parfait état de marche, avec les accessoires mentionnés et le plein de carburant. Il s'engage à le restituer dans le même état, aux date et heure prévues.</p>
                <p>En cas de litige, le tribunal compétent sera celui du siège social de l'agence. Voir conditions générales au verso.</p>
            </div>
            <div className="flex justify-between items-end">
                <div className="w-2/5 text-center">
                    <p className="font-bold">Le Loueur (Car Ghali Pro)</p>
                    <div className="border-b border-dotted w-full mt-8 h-4"></div>
                    <p className="text-xs">(Signature)</p>
                </div>
                <div className="w-2/5 text-center">
                    <p className="font-bold">Le Locataire</p>
                    <div className="border-b border-dotted w-full mt-8 h-4"></div>
                    <p className="text-xs">(Signature précédée de la mention "Lu et Approuvé")</p>
                </div>
            </div>
            <div className="text-center text-xs text-gray-500 mt-4">
                RC: 123456 | IF: 78901234 | ICE: 567890123456789
            </div>
        </footer>
      </div>
    </div>
  );
}
