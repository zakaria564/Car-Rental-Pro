"use client";

import { cn } from '@/lib/utils';
import React from 'react';

// Simplified car parts for the diagram
const carParts = [
    // Pare-chocs
    { id: 'parechoc_av', label: 'Pare-choc Avant', path: "M32,95 C35,100 65,100 68,95 H32" },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', path: "M32,5 C35,0 65,0 68,5 H32" },
    // Côtés
    { id: 'cote_g', label: 'Côté Gauche', path: "M25,15 V85 H30 V15 H25" },
    { id: 'cote_d', label: 'Côté Droit', path: "M75,15 V85 H70 V15 H75" },
    // Portes
    { id: 'porte_avg', label: 'Porte Avant Gauche', path: "M30,50 V85 H38 V50 H30" },
    { id: 'porte_arg', label: 'Porte Arrière Gauche', path: "M30,15 V50 H38 V15 H30" },
    { id: 'porte_avd', label: 'Porte Avant Droite', path: "M70,50 V85 H62 V50 H70" },
    { id: 'porte_ard', label: 'Porte Arrière Droite', path: "M70,15 V50 H62 V15 H70" },
    // Ailes
    { id: 'aile_avg', label: 'Aile Avant Gauche', path: "M25,85 H32 L35,95 H28 L25,85" },
    { id: 'aile_arg', label: 'Aile Arrière Gauche', path: "M25,15 H32 L35,5 H28 L25,15" },
    { id: 'aile_avd', label: 'Aile Avant Droite', path: "M75,85 H68 L65,95 H72 L75,85" },
    { id: 'aile_ard', label: 'Aile Arrière Droite', path: "M75,15 H68 L65,5 H72 L75,15" },
    // Capot & Coffre
    { id: 'capot', label: 'Capot', path: "M40,80 H60 V95 H40 V80" },
    { id: 'coffre', label: 'Coffre', path: "M40,5 H60 V20 H40 V5" },
    // Toit
    { id: 'toit', label: 'Toit', path: "M40,40 H60 V60 H40 V40" },
] as const;

type DamagePart = typeof carParts[number]['id'];

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
      <svg viewBox="0 -5 100 110" className="w-full max-w-xs" >
        <g stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" fill="hsl(var(--card))">
            {/* Car Body Outline */}
            <path 
                d="M30,5 C30,0 70,0 70,5 L75,15 V85 L70,95 C70,100 30,100 30,95 L25,85 V15 L30,5 Z" 
                strokeWidth="1.5" 
                fill="hsl(var(--muted))"
            />
            
            {/* Windows */}
            <path d="M38,20 H62 V38 H38 V20 Z" /> {/* Rear window */}
            <path d="M38,62 H62 V80 H38 V62 Z" /> {/* Front window */}
            <path d: "M38,40 H62 V60 H38 V40 Z" /> {/* Roof area between windows */}

            {/* Mirrors */}
            <path d="M22,60 L25,62 V68 L22,70 Z" /> {/* Left mirror */}
            <path d="M78,60 L75,62 V68 L78,70 Z" /> {/* Right mirror */}

            {/* Lights */}
            <rect x="35" y="93" width="8" height="4" className="fill-yellow-300/50" />
            <rect x="57" y="93" width="8" height="4" className="fill-yellow-300/50" />
            <rect x="35" y="3" width="8" height="4" className="fill-red-500/50" />
            <rect x="57" y="3" width="8" height="4" className="fill-red-500/50" />

            {/* Interactive Parts Overlay */}
            {carParts.map((part) => (
                <path
                    key={part.id}
                    d={part.path}
                    onClick={() => handlePartClick(part.id)}
                    className={cn(
                        "fill-transparent transition-colors",
                        readOnly ? "" : "cursor-pointer hover:fill-yellow-300/50",
                        damages[part.id] && "fill-destructive/70"
                    )}
                />
            ))}
        </g>
      </svg>
    </div>
  );
};

export default CarDamageDiagram;