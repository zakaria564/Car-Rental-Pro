"use client";

import { cn } from '@/lib/utils';
import React from 'react';

// More detailed car parts for the diagram
const carParts = [
    // Front
    { id: 'parechoc_av', label: 'Pare-choc Avant', path: "M26,90.5 h48" },
    { id: 'capot', label: 'Capot', path: "M26,80 h48 v10 h-48z" },
    { id: 'phare_avg', label: 'Phare Avant Gauche', path: "M27,88 h10 v5 h-10z" },
    { id: 'phare_avd', label: 'Phare Avant Droit', path: "M63,88 h10 v5 h-10z" },
    { id: 'parebrise', label: 'Pare-brise', path: "M28,68 h44 v10 h-44z" },
    
    // Left Side
    { id: 'aile_avg', label: 'Aile Avant Gauche', path: "M20,68 v20 h6 v-20z" },
    { id: 'retro_g', label: 'Rétroviseur Gauche', path: "M16,62 v10 l4,2 v-14 l-4,2" },
    { id: 'porte_avg', label: 'Porte Avant Gauche', path: "M20,45 v21 h6 v-21z" },
    { id: 'porte_arg', label: 'Porte Arrière Gauche', path: "M20,25 v18 h6 v-18z" },
    { id: 'aile_arg', label: 'Aile Arrière Gauche', path: "M20,5 v18 h6 v-18z" },
    
    // Right Side
    { id: 'aile_avd', label: 'Aile Avant Droite', path: "M74,68 v20 h6 v-20z" },
    { id: 'retro_d', label: 'Rétroviseur Droit', path: "M80,62 l4,2 v10 l-4,2 v-14" },
    { id: 'porte_avd', label: 'Porte Avant Droite', path: "M74,45 v21 h6 v-21z" },
    { id: 'porte_ard', label: 'Porte Arrière Droite', path: "M74,25 v18 h6 v-18z" },
    { id: 'aile_ard', label: 'Aile Arrière Droite', path: "M74,5 v18 h6 v-18z" },

    // Rear
    { id: 'lunette_ar', label: 'Lunette Arrière', path: "M28,8 h44 v10 h-44z" },
    { id: 'coffre', label: 'Coffre', path: "M26,20 h48 v10 h-48z" },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', path: "M26,3 h48" },
    { id: 'phare_arg', label: 'Phare Arrière Gauche', path: "M27,1 h10 v5 h-10z" },
    { id: 'phare_ard', label: 'Phare Arrière Droit', path: "M63,1 h10 v5 h-10z" },

    // Top
    { id: 'toit', label: 'Toit', path: "M28,32 h44 v34 h-44z" },

    // Wheels
    { id: 'roue_avg', label: 'Roue Avant Gauche', path: "M14,68 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0" },
    { id: 'roue_arg', label: 'Roue Arrière Gauche', path: "M14,20 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0" },
    { id: 'roue_avd', label: 'Roue Avant Droite', path: "M74,68 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0" },
    { id: 'roue_ard', label: 'Roue Arrière Droite', path: "M74,20 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0" },
] as const;

export type DamagePart = typeof carParts[number]['id'];

type CarDamageDiagramProps = {
  damages: { [key in DamagePart]?: boolean };
  onDamagesChange: (damages: { [key in DamagePart]?: boolean }) => void;
  readOnly?: boolean;
};

const CarDamageDiagram: React.FC<CarDamageDiagramProps> = ({ damages, onDamagesChange, readOnly = false }) => {
  const handlePartClick = (part: DamagePart) => {
    if (readOnly) return;
    onDamagesChange({
      ...damages,
      [part]: !damages[part],
    });
  };

  return (
    <div className="w-full flex justify-center p-4 border rounded-md bg-muted/20">
      <svg viewBox="0 0 100 100" className="w-full max-w-xs" >
        <g stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" fill="hsl(var(--card))">
            {/* Car Body Outline */}
            <path 
                d="M20,5 L80,5 L80,95 L20,95 Z" 
                strokeWidth="1.5" 
                fill="hsl(var(--muted))"
                transform="translate(0, -2)"
            />

            {/* Base shape */}
            <path d="M26,5 a4,4 0 0,0 -4,4 v82 a4,4 0 0,0 4,4 h48 a4,4 0 0,0 4,-4 v-82 a4,4 0 0,0 -4,-4 H26z" strokeWidth="1" />
            
            {/* Windows */}
            <path d="M28,8 h44 v10 h-44z" /> {/* Rear window */}
            <path d="M28,68 h44 v10 h-44z" /> {/* Front window */}
            
            {/* Roof */}
            <path d="M28,20 h44 v46 h-44z" strokeWidth="1" /> {/* Roof area */}
            
            {/* Hood/Trunk lines */}
            <path d="M26,30 h48" />
            <path d="M26,80 h48" />

            {/* Wheels */}
            <circle cx="20" cy="26" r="6" strokeWidth="1"/>
            <circle cx="80" cy="26" r="6" strokeWidth="1"/>
            <circle cx="20" cy="74" r="6" strokeWidth="1"/>
            <circle cx="80" cy="74" r="6" strokeWidth="1"/>
           
            {/* Mirrors */}
            <path d="M16,62 v10 l4,2 v-14 l-4,2" strokeWidth="1" />
            <path d="M84,62 v10 l-4,2 v-14 l4,2" strokeWidth="1" />

            {/* Lights */}
            <rect x="27" y="1" width="10" height="5" className="fill-red-500/50" />
            <rect x="63" y="1" width="10" height="5" className="fill-red-500/50" />
            <rect x="27" y="88" width="10" height="5" className="fill-yellow-300/50" />
            <rect x="63" y="88" width="10" height="5" className="fill-yellow-300/50" />

            {/* Interactive Parts Overlay */}
            <g fill="transparent" stroke="transparent" strokeWidth="2">
                {carParts.map((part) => (
                    <path
                        key={part.id}
                        d={part.path}
                        onClick={() => handlePartClick(part.id)}
                        className={cn(
                            "transition-colors",
                            readOnly ? "" : "cursor-pointer hover:fill-yellow-300/50 hover:stroke-yellow-400",
                            damages[part.id] && "fill-destructive/70 stroke-destructive"
                        )}
                    >
                      <title>{part.label}</title>
                    </path>
                ))}
            </g>
        </g>
      </svg>
    </div>
  );
};

export default CarDamageDiagram;
