"use client";

import { cn } from '@/lib/utils';
import { damageTypes, type DamageType } from '@/lib/definitions';
import React from 'react';

// New, more professional layout for the car diagram.
// Top-down view: front is at the bottom, rear is at the top.
export const carParts = [
    // --- Center Line --- (Front is bottom, Rear is top)
    { id: 'parechoc_av', label: 'Pare-choc Avant', x: 22, y: 86, w: 56, h: 7 },
    { id: 'capot', label: 'Capot', x: 31, y: 71, w: 38, h: 15 },
    { id: 'parebrise', label: 'Pare-brise', x: 30, y: 58, w: 40, h: 12 },
    { id: 'toit', label: 'Toit', x: 30, y: 28, w: 40, h: 30 },
    { id: 'lunette_ar', label: 'Lunette Arrière', x: 30, y: 15, w: 40, h: 12 },
    { id: 'coffre', label: 'Coffre', x: 31, y: 8, w: 38, h: 6 },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', x: 22, y: 1, w: 56, h: 6 },

    // --- Left Side ---
    { id: 'phare_avg', label: 'Phare Avant Gauche', x: 22, y: 86, w: 9, h: 7 },
    { id: 'aile_avg', label: 'Aile Avant Gauche', x: 15, y: 70, w: 15, h: 16 },
    { id: 'retro_g', label: 'Rétroviseur Gauche', x: 20, y: 57, w: 5, h: 6 },
    { id: 'porte_avg', label: 'Porte Avant Gauche', x: 15, y: 40, w: 15, h: 30 },
    { id: 'porte_arg', label: 'Porte Arrière Gauche', x: 15, y: 15, w: 15, h: 25 },
    { id: 'aile_arg', label: 'Aile Arrière Gauche', x: 15, y: 7, w: 15, h: 8 },
    { id: 'phare_arg', label: 'Phare Arrière Gauche', x: 22, y: 1, w: 9, h: 6 },
    { id: 'roue_avg', label: 'Roue Avant Gauche', x: 5, y: 72, w: 10, h: 15 },
    { id: 'roue_arg', label: 'Roue Arrière Gauche', x: 5, y: 15, w: 10, h: 15 },

    // --- Right Side ---
    { id: 'phare_avd', label: 'Phare Avant Droit', x: 69, y: 86, w: 9, h: 7 },
    { id: 'aile_avd', label: 'Aile Avant Droite', x: 70, y: 70, w: 15, h: 16 },
    { id: 'retro_d', label: 'Rétroviseur Droit', x: 75, y: 57, w: 5, h: 6 },
    { id: 'porte_avd', label: 'Porte Avant Droite', x: 70, y: 40, w: 15, h: 30 },
    { id: 'porte_ard', label: 'Porte Arrière Droite', x: 70, y: 15, w: 15, h: 25 },
    { id: 'aile_ard', label: 'Aile Arrière Droite', x: 70, y: 7, w: 15, h: 8 },
    { id: 'phare_ard', label: 'Phare Arrière Droit', x: 69, y: 1, w: 9, h: 6 },
    { id: 'roue_avd', label: 'Roue Avant Droite', x: 85, y: 72, w: 10, h: 15 },
    { id: 'roue_ard', label: 'Roue Arrière Droite', x: 85, y: 15, w: 10, h: 15 },
] as const;


export type DamagePart = typeof carParts[number]['id'];

type CarDamageDiagramProps = {
  damages: { [key in DamagePart]?: DamageType };
  onDamagesChange: (damages: { [key in DamagePart]?: DamageType }) => void;
  readOnly?: boolean;
};

const CarDamageDiagram: React.FC<CarDamageDiagramProps> = ({ damages, onDamagesChange, readOnly = false }) => {
  const handlePartClick = (partId: DamagePart) => {
    if (readOnly) return;

    const damageCycle: (DamageType | undefined)[] = ['rayure', 'rayure_importante', 'choc', 'a_remplacer', undefined];
    
    const currentDamage = damages[partId];
    const currentIndex = currentDamage ? damageCycle.indexOf(currentDamage) : -1; // -1 if no damage
    const nextIndex = (currentIndex + 1) % damageCycle.length;
    const nextDamage = damageCycle[nextIndex];
    
    const newDamages = { ...damages };
    if (nextDamage) {
        newDamages[partId] = nextDamage;
    } else {
        delete newDamages[partId];
    }
    
    onDamagesChange(newDamages);
  };

  return (
    <div className="w-full flex flex-col items-center p-4 border rounded-md bg-muted/20">
      <svg viewBox="0 0 100 100" className="w-full max-w-xs" >
        {/* Professional Car Outline */}
        <g stroke="hsl(var(--muted-foreground))" strokeWidth="1" fill="hsl(var(--card))">
            {/* Main Body */}
            <path d="M 22,93 C 18,93 15,90 15,85 L 15,15 C 15,10 18,7 22,7 L 78,7 C 82,7 85,10 85,15 L 85,85 C 85,90 82,93 78,93 Z" stroke="none" fill="hsl(var(--muted))" />

            {/* Cabin */}
            <path d="M 25,78 L 30,70 L 70,70 L 75,78 L 75,22 L 70,14 L 30,14 L 25,22 Z" />
            
            {/* Window separators */}
            <line x1="50" y1="78" x2="50" y2="14" strokeWidth="0.5" />
            <line x1="25" y1="50" x2="75" y2="50" strokeWidth="0.5" />
            
            {/* Hood/Trunk lines */}
            <line x1="30" y1="70" x2="70" y2="70" />
            <line x1="30" y1="14" x2="70" y2="14" />
            
            {/* Side mirrors */}
            <path d="M 25,60 L 20,63 L 20,57 Z" fill="hsl(var(--muted))"/>
            <path d="M 75,60 L 80,63 L 80,57 Z" fill="hsl(var(--muted))"/>
        </g>
        
        {/* Interactive Squares Overlay */}
        <g>
            {carParts.map((part) => (
                <rect
                    key={part.id}
                    x={part.x}
                    y={part.y}
                    width={part.w}
                    height={part.h}
                    onClick={() => handlePartClick(part.id)}
                    className={cn(
                        "transition-colors",
                        readOnly ? "cursor-not-allowed" : "cursor-pointer",
                        damages[part.id] 
                            ? damageTypes[damages[part.id]!].color 
                            : "fill-transparent stroke-transparent hover:fill-accent/30"
                    )}
                >
                  <title>{part.label}{damages[part.id] ? `: ${damageTypes[damages[part.id]!].label}` : ''}</title>
                </rect>
            ))}
        </g>
      </svg>
      <div className="flex justify-center gap-2 flex-wrap mt-4 text-xs">
          {Object.values(damageTypes).map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                  <div className={cn("w-3 h-3 rounded-sm border", color)} />
                  <span>{label}</span>
              </div>
          ))}
      </div>
    </div>
  );
};

export default CarDamageDiagram;
