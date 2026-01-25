"use client";

import { cn } from '@/lib/utils';
import { damageTypes, type DamageType } from '@/lib/definitions';
import React from 'react';
import { XCircle } from 'lucide-react';

// A professional and detailed car diagram.
// This is a top-down view. Front is at the top.
// Per your instruction, this represents a left-hand drive car (volant à gauche),
// so the left side of the diagram is the driver's side.
export const carParts = [
    // --- Center Line ---
    { id: 'parechoc_av', label: 'Pare-choc Avant', x: 25, y: 5, w: 50, h: 5 },
    { id: 'capot', label: 'Capot', x: 30, y: 10, w: 40, h: 20 },
    { id: 'parebrise', label: 'Pare-brise', x: 28, y: 30, w: 44, h: 15 },
    { id: 'toit', label: 'Toit', x: 28, y: 45, w: 44, h: 30 },
    { id: 'lunette_ar', label: 'Lunette Arrière', x: 28, y: 75, w: 44, h: 10 },
    { id: 'coffre', label: 'Coffre', x: 30, y: 85, w: 40, h: 10 },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', x: 25, y: 95, w: 50, h: 5 },

    // --- Left Side (Driver's side) ---
    { id: 'phare_avg', label: 'Phare Avant Gauche', x: 25, y: 5, w: 15, h: 5 },
    { id: 'aile_avg', label: 'Aile Avant Gauche', x: 10, y: 10, w: 20, h: 20 },
    { id: 'retro_g', label: 'Rétroviseur Gauche', x: 22, y: 32, w: 6, h: 5 },
    { id: 'porte_avg', label: 'Porte Avant Gauche', x: 10, y: 30, w: 18, h: 25 },
    { id: 'porte_arg', label: 'Porte Arrière Gauche', x: 10, y: 55, w: 18, h: 25 },
    { id: 'aile_arg', label: 'Aile Arrière Gauche', x: 10, y: 80, w: 20, h: 15 },
    { id: 'phare_arg', label: 'Phare Arrière Gauche', x: 25, y: 95, w: 15, h: 5 },
    { id: 'roue_avg', label: 'Roue Avant Gauche', x: 5, y: 15, w: 10, h: 15 },
    { id: 'roue_arg', label: 'Roue Arrière Gauche', x: 5, y: 75, w: 10, h: 15 },

    // --- Right Side (Passenger side) ---
    { id: 'phare_avd', label: 'Phare Avant Droit', x: 60, y: 5, w: 15, h: 5 },
    { id: 'aile_avd', label: 'Aile Avant Droite', x: 70, y: 10, w: 20, h: 20 },
    { id: 'retro_d', label: 'Rétroviseur Droit', x: 72, y: 32, w: 6, h: 5 },
    { id: 'porte_avd', label: 'Porte Avant Droite', x: 72, y: 30, w: 18, h: 25 },
    { id: 'porte_ard', label: 'Porte Arrière Droite', x: 72, y: 55, w: 18, h: 25 },
    { id: 'aile_ard', label: 'Aile Arrière Droite', x: 70, y: 80, w: 20, h: 15 },
    { id: 'phare_ard', label: 'Phare Arrière Droit', x: 60, y: 95, w: 15, h: 5 },
    { id: 'roue_avd', label: 'Roue Avant Droite', x: 85, y: 15, w: 10, h: 15 },
    { id: 'roue_ard', label: 'Roue Arrière Droite', x: 85, y: 75, w: 10, h: 15 },
] as const;

export type DamagePart = typeof carParts[number]['id'];

type CarDamageDiagramProps = {
  damages: { [key in DamagePart]?: DamageType };
  onDamagesChange: (damages: { [key in DamagePart]?: DamageType }) => void;
  readOnly?: boolean;
};

const CarDamageDiagram: React.FC<CarDamageDiagramProps> = ({ damages, onDamagesChange, readOnly = false }) => {
  const [selectedDamageType, setSelectedDamageType] = React.useState<DamageType | undefined>('rayure');

  const handleDamageTypeSelect = (type: DamageType | undefined) => {
    // If the same type is clicked again, we can interpret it as a toggle to 'erase' mode.
    if (selectedDamageType === type) {
        setSelectedDamageType(undefined);
    } else {
        setSelectedDamageType(type);
    }
  };

  const handlePartClick = (partId: DamagePart) => {
    if (readOnly) return;

    const newDamages = { ...damages };
    
    if (selectedDamageType) {
        // If the part already has the selected damage, remove it.
        // Otherwise, set it. This makes clicking a part a toggle for the selected damage.
        if (newDamages[partId] === selectedDamageType) {
            delete newDamages[partId];
        } else {
            newDamages[partId] = selectedDamageType;
        }
    } else {
        // If no damage type is selected (erase mode), just remove any existing damage.
        delete newDamages[partId];
    }
    
    onDamagesChange(newDamages);
  };

  return (
    <div className="w-full flex flex-col items-center p-4 border rounded-md bg-muted/20">
      <svg viewBox="0 0 100 110" className="w-full max-w-xs" >
        {/* Car Bodywork Outline (Carrosserie) */}
        <g stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" fill="hsl(var(--card))">
            {/* Main body shape */}
            <path d="M 20 10 C 10 10, 10 20, 10 30 L 10 80 C 10 90, 10 100, 20 100 L 80 100 C 90 100, 90 90, 90 80 L 90 30 C 90 20, 90 10, 80 10 Z" />
            
            {/* Wheels arches */}
            <path d="M 10 15 C 5 15, 5 25, 10 25" fill="none" />
            <path d="M 10 75 C 5 75, 5 85, 10 85" fill="none" />
            <path d="M 90 15 C 95 15, 95 25, 90 25" fill="none" />
            <path d="M 90 75 C 95 75, 95 85, 90 85" fill="none" />

            {/* Cabin */}
            <rect x="28" y="30" width="44" height="45" rx="2" />

            {/* Windows */}
            <path d="M 30 32 L 30 48 L 70 48 L 70 32 Z" strokeWidth="0.2" fill="hsl(var(--muted))" />
            <line x1="50" y1="32" x2="50" y2="48" stroke="hsl(var(--muted-foreground))" strokeWidth="0.2" /> {/* B-pillar */}
            <path d="M 30 52 L 30 73 L 70 73 L 70 52 Z" strokeWidth="0.2" fill="hsl(var(--muted))" />

            {/* Hood & Trunk Lines */}
            <line x1="30" y1="10" x2="30" y2="30" />
            <line x1="70" y1="10" x2="70" y2="30" />
            <line x1="30" y1="75" x2="30" y2="100" />
            <line x1="70" y1="75" x2="70" y2="100" />

            {/* Side Mirrors */}
            <path d="M 23 32 L 20 35 L 23 38 Z" />
            <path d="M 77 32 L 80 35 L 77 38 Z" />

             {/* Lights */}
            <rect x="25" y="6" width="15" height="4" rx="1" fill="hsl(var(--muted))" />
            <rect x="60" y="6" width="15" height="4" rx="1" fill="hsl(var(--muted))" />
            <rect x="25" y="100" width="15" height="4" rx="1" fill="hsl(var(--muted))" />
            <rect x="60" y="100" width="15" height="4" rx="1" fill="hsl(var(--muted))" />
        </g>
        
        {/* Interactive Overlay */}
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
          {(Object.keys(damageTypes) as DamageType[]).map((type) => {
              const { label, color } = damageTypes[type];
              return (
                <button
                    type="button"
                    key={type}
                    onClick={() => !readOnly && handleDamageTypeSelect(type)}
                    disabled={readOnly}
                    className={cn(
                        "flex items-center gap-1.5 p-1.5 rounded-md border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        selectedDamageType === type 
                          ? 'border-primary bg-primary/10' 
                          : 'border-transparent hover:bg-muted'
                    )}
                >
                    <div className={cn("w-3 h-3 rounded-sm border", color)} />
                    <span>{label}</span>
                </button>
              )
          })}
           <button
                type="button"
                onClick={() => !readOnly && handleDamageTypeSelect(undefined)}
                disabled={readOnly}
                className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded-md border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    selectedDamageType === undefined 
                      ? 'border-primary bg-primary/10' 
                      : 'border-transparent hover:bg-muted'
                )}
            >
                <XCircle className="w-3.5 h-3.5" />
                <span>Effacer</span>
            </button>
      </div>
    </div>
  );
};

export default CarDamageDiagram;
