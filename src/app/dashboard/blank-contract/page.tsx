'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import React from 'react';

const CarFrontView = () => (
    <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto border border-gray-300 rounded">
        {/* Car Body */}
        <path d="M5,35 C5,25 15,20 20,18 L80,18 C85,20 95,25 95,35 V50 H5 Z" fill="#f0f0f0" stroke="#888" strokeWidth="0.5" />
        {/* Windshield */}
        <path d="M20,18 L30,5 H70 L80,18 Z" fill="#e0e0e0" stroke="#888" strokeWidth="0.5" />
        {/* Mirrors */}
        <path d="M18,18 L13,16 V22 L18,20Z" fill="#ccc" stroke="#888" strokeWidth="0.5" />
        <path d="M82,18 L87,16 V22 L82,20Z" fill="#ccc" stroke="#888" strokeWidth="0.5" />
        {/* Grille */}
        <rect x="35" y="25" width="30" height="10" fill="none" stroke="#888" strokeWidth="0.5" />
        <line x1="35" y1="28" x2="65" y2="28" stroke="#888" strokeWidth="0.5" />
        <line x1="35" y1="32" x2="65" y2="32" stroke="#888" strokeWidth="0.5" />
        {/* Headlights */}
        <path d="M20,25 C25,22 33,22 33,25 L33,32 C33,35 25,35 20,32 Z" fill="#fff" stroke="#888" strokeWidth="0.5" />
        <path d="M80,25 C75,22 67,22 67,25 L67,32 C67,35 75,35 80,32 Z" fill="#fff" stroke="#888" strokeWidth="0.5" />
        {/* Bumper */}
        <rect x="15" y="40" width="70" height="8" fill="#ccc" stroke="#888" strokeWidth="0.5" />
        {/* Wheels hint */}
        <rect x="10" y="50" width="15" height="5" fill="#aaa" />
        <rect x="75" y="50" width="15" height="5" fill="#aaa" />
    </svg>
);

const CarBackView = () => (
    <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto border border-gray-300 rounded">
        {/* Car Body */}
        <path d="M5,35 C5,25 15,20 20,18 L80,18 C85,20 95,25 95,35 V50 H5 Z" fill="#f0f0f0" stroke="#888" strokeWidth="0.5" />
        {/* Rear Windshield */}
        <path d="M20,18 L30,5 H70 L80,18 Z" fill="#e0e0e0" stroke="#888" strokeWidth="0.5" />
        {/* Mirrors */}
        <path d="M18,18 L13,16 V22 L18,20Z" fill="#ccc" stroke="#888" strokeWidth="0.5" />
        <path d="M82,18 L87,16 V22 L82,20Z" fill="#ccc" stroke="#888" strokeWidth="0.5" />
        {/* Trunk line */}
        <line x1="15" y1="22" x2="85" y2="22" stroke="#888" strokeWidth="0.5" />
        {/* Tail lights */}
        <rect x="20" y="25" width="15" height="8" fill="#ff7777" stroke="red" strokeWidth="0.5" />
        <rect x="65" y="25" width="15" height="8" fill="#ff7777" stroke="red" strokeWidth="0.5" />
        {/* License plate area */}
        <rect x="40" y="30" width="20" height="8" fill="#fff" stroke="#888" strokeWidth="0.5" />
        {/* Bumper */}
        <rect x="15" y="40" width="70" height="8" fill="#ccc" stroke="#888" strokeWidth="0.5" />
        {/* Wheels hint */}
        <rect x="10" y="50" width="15" height="5" fill="#aaa" />
        <rect x="75" y="50" width="15" height="5" fill="#aaa" />
    </svg>
);

const CarSideView = ({ side = 'left' }: { side?: 'left' | 'right' }) => (
  <svg viewBox="0 0 150 50" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto border border-gray-300 rounded" style={{ transform: side === 'right' ? 'scaleX(-1)' : 'none' }}>
    <path d="M 10 40 C 5 30, 15 20, 25 20 H 125 C 140 20, 145 30, 140 40 Z" fill="#f0f0f0" stroke="#888" strokeWidth="0.5" />
    <path d="M 30 20 L 50 5 H 90 L 110 20 Z" fill="#e0e0e0" stroke="#888" strokeWidth="0.5" />
    {/* Mirror */}
    <path d="M 48 20 L 43 18 V 22 L 48 20 Z" fill="#ccc" stroke="#888" strokeWidth="0.5" />
    <circle cx="40" cy="40" r="7" fill="#fff" stroke="#888" strokeWidth="0.5" />
    <circle cx="110" cy="40" r="7" fill="#fff" stroke="#888" strokeWidth="0.5" />
  </svg>
);

export default function BlankContractPage() {
  const handlePrint = () => {
    window.print();
  };

  const renderLines = (num: number) => {
    return Array.from({ length: num }).map((_, i) => (
      <div key={i} className="border-b border-gray-300 h-6"></div>
    ));
  };
  
  const CheckboxItem = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 text-sm">
        <div className="w-3 h-3 border border-gray-400 rounded-sm"></div>
        <span>{label}</span>
    </div>
  );

  return (
    <>
      <div className="no-print mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Contrat de Location Vierge</h1>
        <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" /> Imprimer le contrat
        </Button>
      </div>

      <div id="blank-contract" className="p-4 bg-white text-black text-xs sm:text-sm md:text-base lg:text-lg shadow-lg rounded-lg border font-sans">
        <style jsx global>{`
          @media print {
            body * {
                visibility: hidden;
            }
            #blank-contract, #blank-contract * {
                visibility: visible;
            }
            #blank-contract {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                box-shadow: none !important;
                border: none !important;
                padding: 0;
                margin: 0;
            }
            .no-print { 
                display: none !important; 
            }
            body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                background-color: white;
            }
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        `}</style>
        
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
                        <CarSideView side="left" />
                        <p className="text-xs font-semibold mt-1">Côté Gauche</p>
                    </div>
                    <div className="text-center">
                        <CarFrontView />
                        <p className="text-xs font-semibold mt-1">Avant</p>
                    </div>
                    <div className="text-center">
                        <CarBackView />
                        <p className="text-xs font-semibold mt-1">Arrière</p>
                    </div>
                    <div className="text-center">
                        <CarSideView side="right" />
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
    </>
  );
}
