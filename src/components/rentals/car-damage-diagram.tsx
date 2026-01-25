"use client";

import { cn } from '@/lib/utils';
import { damageTypes, type DamageType } from '@/lib/definitions';
import React from 'react';

// New simplified and corrected layout.
// Top-down view: front is top, left is left.
export const carParts = [
    // --- Center Line ---
    { id: 'parechoc_av', label: 'Pare-choc Avant', x: 30, y: 88, w: 40, h: 5 },
    { id: 'capot', label: 'Capot', x: 35, y: 70, w: 30, h: 18 },
    { id: 'parebrise', label: 'Pare-brise', x: 32, y: 58, w: 36, h: 12 },
    { id: 'toit', label: 'Toit', x: 32, y: 28, w: 36, h: 30 },
    { id: 'lunette_ar', label: 'Lunette Arrière', x: 32, y: 16, w: 36, h: 12 },
    { id: 'coffre', label: 'Coffre', x: 35, y: 5, w: 30, h: 11 },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', x: 30, y: 0, w: 40, h: 5 },

    // --- Left Side (Driver's side) ---
    { id: 'phare_avg', label: 'Phare Avant Gauche', x: 22, y: 88, w: 8, h: 5 },
    { id: 'aile_avg', label: 'Aile Avant Gauche', x: 22, y: 65, w: 10, h: 23 },
    { id: 'retro_g', label: 'Rétroviseur Gauche', x: 17, y: 56, w: 5, h: 4 },
    { id: 'porte_avg', label: 'Porte Avant Gauche', x: 22, y: 40, w: 10, h: 25 },
    { id: 'porte_arg', label: 'Porte Arrière Gauche', x: 22, y: 18, w: 10, h: 22 },
    { id: 'aile_arg', label: 'Aile Arrière Gauche', x: 22, y: 5, w: 10, h: 13 },
    { id: 'phare_arg', label: 'Phare Arrière Gauche', x: 22, y: 0, w: 8, h: 5 },
    { id: 'roue_avg', label: 'Roue Avant Gauche', x: 10, y: 70, w: 12, h: 12 },
    { id: 'roue_arg', label: 'Roue Arrière Gauche', x: 10, y: 20, w: 12, h: 12 },

    // --- Right Side (Passenger's side) ---
    { id: 'phare_avd', label: 'Phare Avant Droit', x: 70, y: 88, w: 8, h: 5 },
    { id: 'aile_avd', label: 'Aile Avant Droite', x: 68, y: 65, w: 10, h: 23 },
    { id: 'retro_d', label: 'Rétroviseur Droit', x: 78, y: 56, w: 5, h: 4 },
    { id: 'porte_avd', label: 'Porte Avant Droite', x: 68, y: 40, w: 10, h: 25 },
    { id: 'porte_ard', label: 'Porte Arrière Droite', x: 68, y: 18, w: 10, h: 22 },
    { id: 'aile_ard', label: 'Aile Arrière Droite', x: 68, y: 5, w: 10, h: 13 },
    { id: 'phare_ard', label: 'Phare Arrière Droit', x: 70, y: 0, w: 8, h: 5 },
    { id: 'roue_avd', label: 'Roue Avant Droite', x: 78, y: 70, w: 12, h: 12 },
    { id: 'roue_ard', label: 'Roue Arrière Droite', x: 78, y: 20, w: 12, h: 12 },
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
        {/* Simplified Car Outline */}
        <path 
            d="M22,10 L78,10 L85,25 L85,75 L78,90 L22,90 L15,75 L15,25 Z" 
            stroke="hsl(var(--muted-foreground))" 
            strokeWidth="1" 
            fill="hsl(var(--muted))"
        />
        {/* Roof */}
        <rect x="25" y="30" width="50" height="40" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" fill="hsl(var(--card))" />
        {/* Windshield */}
        <line x1="25" y1="70" x2="20" y2="90" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
        <line x1="75" y1="70" x2="80" y2="90" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />

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
                            : "fill-transparent stroke-transparent hover:stroke-accent hover:stroke-2"
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
