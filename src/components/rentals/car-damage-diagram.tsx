
"use client";

import { cn } from '@/lib/utils';
import React from 'react';

// Simplified car parts for the diagram
const carParts = [
    { id: 'parechoc_av', label: 'Pare-choc Avant', path: "M20,60 H80 L90,50 H10 L20,60" },
    { id: 'capot', label: 'Capot', path: "M25,50 H75 L70,40 H30 L25,50" },
    { id: 'toit', label: 'Toit', path: "M30,30 H70 L65,20 H35 L30,30" },
    { id: 'coffre', label: 'Coffre', path: "M25,10 H75 L70,20 H30 L25,10" },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', path: "M20,0 H80 L90,10 H10 L20,0" },
    { id: 'av_g', label: 'Avant Gauche', path: "M10,50 L20,60 V80 L10,70 V50" },
    { id: 'av_d', label: 'Avant Droit', path: "M90,50 L80,60 V80 L90,70 V50" },
    { id: 'ar_g', label: 'Arrière Gauche', path: "M10,10 L20,0 V-20 L10,-10 V10" },
    { id: 'ar_d', label: 'Arrière Droit', path: "M90,10 L80,0 V-20 L90,-10 V10" },
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
    <div className="w-full flex justify-center p-4 border rounded-md">
      <svg viewBox="-10 -30 120 120" className="w-full max-w-xs" style={{ transform: 'scaleY(-1)' }}>
        <g stroke="hsl(var(--foreground))" strokeWidth="1" fill="hsl(var(--card))">
           {/* Main Body */}
           <path d="M20,80 L80,80 L80, -20 L20,-20 L20,80" fill="hsl(var(--muted))" />
           <path d="M25,70 L75,70 L75,-10 L25,-10 L25,70" />
           {/* Windows */}
           <path d="M30,65 L70,65 L70,35 H30 V65" strokeWidth="0.5" />
           <line x1="50" y1="65" x2="50" y2="35" strokeWidth="0.5" />
           <line x1="30" y1="50" x2="70" y2="50" strokeWidth="0.5" />

            {carParts.map((part) => (
                <path
                    key={part.id}
                    d={part.path}
                    onClick={() => handlePartClick(part.id)}
                    className={cn(
                        "transition-colors",
                        readOnly ? "" : "cursor-pointer hover:fill-yellow-300",
                        damages[part.id] && "fill-destructive/70"
                    )}
                />
            ))}
        </g>
         {/* Wheels */}
        <circle cx="20" cy="-10" r="8" fill="hsl(var(--foreground))" />
        <circle cx="80" cy="-10" r="8" fill="hsl(var(--foreground))" />
        <circle cx="20" cy="70" r="8" fill="hsl(var(--foreground))" />
        <circle cx="80" cy="70" r="8" fill="hsl(var(--foreground))" />
      </svg>
    </div>
  );
};

export default CarDamageDiagram;

    