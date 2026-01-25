"use client";

import { cn } from '@/lib/utils';
import { damageTypes, type DamageType } from '@/lib/definitions';
import React from 'react';
import { XCircle } from 'lucide-react';

// A more professional and detailed car diagram structure.
// This is a top-down view. Front is at the top. Left is left.
// Coordinates are for a 200x400 viewBox.

export const carParts = [
    // --- Center Line ---
    { id: 'parechoc_av', label: 'Pare-choc Avant', x: 70, y: 15, w: 60, h: 20 },
    { id: 'capot', label: 'Capot', x: 60, y: 35, w: 80, h: 55 },
    { id: 'parebrise', label: 'Pare-brise', x: 55, y: 95, w: 90, h: 60 },
    { id: 'toit', label: 'Toit', x: 55, y: 155, w: 90, h: 100 },
    { id: 'lunette_ar', label: 'Lunette Arrière', x: 55, y: 255, w: 90, h: 30 },
    { id: 'coffre', label: 'Coffre', x: 60, y: 285, w: 80, h: 70 },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', x: 70, y: 355, w: 60, h: 25 },

    // --- Left Side (Gauche) ---
    { id: 'phare_avg', label: 'Phare Avant Gauche', x: 55, y: 20, w: 25, h: 20 },
    { id: 'aile_avg', label: 'Aile Avant Gauche', x: 40, y: 40, w: 15, h: 55 },
    { id: 'retro_g', label: 'Rétroviseur Gauche', x: 30, y: 100, w: 25, h: 25 },
    { id: 'porte_avg', label: 'Porte Avant Gauche', x: 40, y: 100, w: 15, h: 85 },
    { id: 'porte_arg', label: 'Porte Arrière Gauche', x: 40, y: 185, w: 15, h: 100 },
    { id: 'aile_arg', label: 'Aile Arrière Gauche', x: 40, y: 285, w: 15, h: 70 },
    { id: 'phare_arg', label: 'Phare Arrière Gauche', x: 55, y: 355, w: 25, h: 20 },
    { id: 'roue_avg', label: 'Roue Avant Gauche', x: 15, y: 70, w: 25, h: 40 },
    { id: 'roue_arg', label: 'Roue Arrière Gauche', x: 15, y: 290, w: 25, h: 40 },
    
    // --- Right Side (Droite) ---
    { id: 'phare_avd', label: 'Phare Avant Droit', x: 120, y: 20, w: 25, h: 20 },
    { id: 'aile_avd', label: 'Aile Avant Droite', x: 145, y: 40, w: 15, h: 55 },
    { id: 'retro_d', label: 'Rétroviseur Droit', x: 145, y: 100, w: 25, h: 25 },
    { id: 'porte_avd', label: 'Porte Avant Droite', x: 145, y: 100, w: 15, h: 85 },
    { id: 'porte_ard', label: 'Porte Arrière Droite', x: 145, y: 185, w: 15, h: 100 },
    { id: 'aile_ard', label: 'Aile Arrière Droite', x: 145, y: 285, w: 15, h: 70 },
    { id: 'phare_ard', label: 'Phare Arrière Droit', x: 120, y: 355, w: 25, h: 20 },
    { id: 'roue_avd', label: 'Roue Avant Droite', x: 160, y: 70, w: 25, h: 40 },
    { id: 'roue_ard', label: 'Roue Arrière Droite', x: 160, y: 290, w: 25, h: 40 },
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
    if (readOnly) return;
    setSelectedDamageType(type);
  };

  const handlePartClick = (partId: DamagePart) => {
    if (readOnly) return;

    const newDamages = { ...damages };
    
    if (selectedDamageType) {
        if (newDamages[partId] === selectedDamageType) {
            delete newDamages[partId];
        } else {
            newDamages[partId] = selectedDamageType;
        }
    } else { // Erase mode
        delete newDamages[partId];
    }
    
    onDamagesChange(newDamages);
  };

  return (
    <div className="w-full flex flex-col items-center p-4 border rounded-md bg-muted/20">
      <div className="relative w-full max-w-56">
          {/* Visual SVG Layer */}
          <svg viewBox="0 0 200 400" className="w-full" >
              <g transform="translate(0, 10)">
                  {/* Car body */}
                  <path
                      d="M 85,10 C 70,10 60,20 55,30 L 40,70 C 35,80 35,90 40,100 L 40,290 C 35,300 35,310 40,320 L 55,360 C 60,370 70,380 85,380 L 115,380 C 130,380 140,370 145,360 L 160,320 C 165,310 165,300 160,290 L 160,100 C 165,90 165,80 160,70 L 145,30 C 140,20 130,10 115,10 Z"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="1.5"
                      fill="hsl(var(--card))"
                  />
                  {/* Cabin/Windows */}
                  <path 
                      d="M 55,95 L 55,285 L 145,285 L 145,95 Z"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="1"
                      fill="hsl(var(--muted))"
                  />
                  <line x1="55" y1="180" x2="145" y2="180" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
                  <line x1="99.5" y1="95" x2="99.5" y2="285" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />

                  {/* Hood/Trunk lines */}
                  <line x1="60" y1="90" x2="140" y2="90" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
                  <line x1="60" y1="285" x2="140" y2="285" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
                  
                  {/* Side mirrors */}
                  <path d="M 35,105 L 40,100 L 40,120 L 35,125 Z" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--card))" strokeWidth="1"/>
                  <path d="M 165,105 L 160,100 L 160,120 L 165,125 Z" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--card))" strokeWidth="1"/>
              </g>
          </svg>

          {/* Interactive SVG Layer */}
          <div className="absolute top-0 left-0 w-full h-full">
              <svg viewBox="0 0 200 400" className="w-full h-full">
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
                                      : "fill-transparent stroke-transparent hover:fill-primary/20"
                              )}
                          >
                            <title>{part.label}{damages[part.id] ? `: ${damageTypes[damages[part.id]!].label}` : ''}</title>
                          </rect>
                      ))}
                  </g>
              </svg>
          </div>
      </div>

      <div className="flex justify-center gap-2 flex-wrap mt-4 text-xs">
          {(Object.keys(damageTypes) as DamageType[]).map((type) => {
              const { label, color } = damageTypes[type];
              return (
                <button
                    type="button"
                    key={type}
                    onClick={() => handleDamageTypeSelect(type)}
                    disabled={readOnly}
                    className={cn(
                        "flex items-center gap-1.5 p-1.5 rounded-md border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        selectedDamageType === type 
                          ? 'border-primary bg-primary/10' 
                          : 'border-transparent hover:bg-muted'
                    )}
                >
                    <div className={cn("w-3 h-3 rounded-sm border", color.replace('bg-', 'border-'))} />
                    <span>{label}</span>
                </button>
              )
          })}
           <button
                type="button"
                onClick={() => handleDamageTypeSelect(undefined)}
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
