"use client";

import { cn } from '@/lib/utils';
import { damageTypes, type DamageType } from '@/lib/definitions';
import React from 'react';
import { XCircle } from 'lucide-react';

// A professional and detailed car diagram structure.
// This is a top-down view, oriented horizontally. Front is at the left.
// Coordinates are for a 400x200 viewBox.
export const carParts = [
    // --- Center Line (Front to Back) ---
    { id: 'parechoc_av', label: 'Pare-choc Avant', x: 15, y: 70, w: 20, h: 60 },
    { id: 'capot', label: 'Capot', x: 35, y: 60, w: 55, h: 80 },
    { id: 'parebrise', label: 'Pare-brise', x: 95, y: 55, w: 60, h: 90 },
    { id: 'toit', label: 'Toit', x: 155, y: 55, w: 100, h: 90 },
    { id: 'lunette_ar', label: 'Lunette Arrière', x: 255, y: 55, w: 30, h: 90 },
    { id: 'coffre', label: 'Coffre', x: 285, y: 60, w: 70, h: 80 },
    { id: 'parechoc_ar', label: 'Pare-choc Arrière', x: 355, y: 70, w: 25, h: 60 },

    // --- Bottom Side (Left side of the car - Gauche) ---
    { id: 'phare_avg', label: 'Phare Avant Gauche', x: 20, y: 120, w: 20, h: 25 },
    { id: 'aile_avg', label: 'Aile Avant Gauche', x: 40, y: 145, w: 55, h: 15 },
    { id: 'retro_g', label: 'Rétroviseur Gauche', x: 100, y: 145, w: 25, h: 25 },
    { id: 'porte_avg', label: 'Porte Avant Gauche', x: 100, y: 145, w: 85, h: 15 },
    { id: 'porte_arg', label: 'Porte Arrière Gauche', x: 185, y: 145, w: 100, h: 15 },
    { id: 'aile_arg', label: 'Aile Arrière Gauche', x: 285, y: 145, w: 70, h: 15 },
    { id: 'phare_arg', label: 'Phare Arrière Gauche', x: 355, y: 120, w: 20, h: 25 },
    { id: 'roue_avg', label: 'Roue Avant Gauche', x: 70, y: 160, w: 40, h: 25 },
    { id: 'roue_arg', label: 'Roue Arrière Gauche', x: 290, y: 160, w: 40, h: 25 },

    // --- Top Side (Right side of the car - Droite) ---
    { id: 'phare_avd', label: 'Phare Avant Droit', x: 20, y: 55, w: 20, h: 25 },
    { id: 'aile_avd', label: 'Aile Avant Droite', x: 40, y: 40, w: 55, h: 15 },
    { id: 'retro_d', label: 'Rétroviseur Droit', x: 100, y: 30, w: 25, h: 25 },
    { id: 'porte_avd', label: 'Porte Avant Droite', x: 100, y: 40, w: 85, h: 15 },
    { id: 'porte_ard', label: 'Porte Arrière Droite', x: 185, y: 40, w: 100, h: 15 },
    { id: 'aile_ard', label: 'Aile Arrière Droite', x: 285, y: 40, w: 70, h: 15 },
    { id: 'phare_ard', label: 'Phare Arrière Droit', x: 355, y: 55, w: 20, h: 25 },
    { id: 'roue_avd', label: 'Roue Avant Droite', x: 70, y: 15, w: 40, h: 25 },
    { id: 'roue_ard', label: 'Roue Arrière Droite', x: 290, y: 15, w: 40, h: 25 },
    
] as const;

export type DamagePart = typeof carParts[number]['id'];

type CarDamageDiagramProps = {
  damages: { [key in DamagePart]?: DamageType };
  onDamagesChange: (damages: { [key in DamagePart]?: DamageType }) => void;
  readOnly?: boolean;
  showLegend?: boolean;
};

const CarDamageDiagram: React.FC<CarDamageDiagramProps> = ({ damages, onDamagesChange, readOnly = false, showLegend = true }) => {
  const [selectedDamageType, setSelectedDamageType] = React.useState<DamageType | undefined>('R');

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
    <div className="w-full flex flex-col items-center p-2 border rounded-md bg-muted/20">
      <div className="relative w-full max-w-xs">
          {/* Visual SVG Layer */}
          <svg viewBox="0 0 400 200" className="w-full" >
              <g>
                  {/* Car body */}
                  <path
                      d="M 10,85 C 10,70 20,60 30,55 L 70,40 C 80,35 90,35 100,40 L 290,40 C 300,35 310,35 320,40 L 360,55 C 370,60 380,70 380,85 L 380,115 C 380,130 370,140 360,145 L 320,160 C 310,165 300,165 290,160 L 100,160 C 90,165 80,165 70,160 L 30,145 C 20,140 10,130 10,115 Z"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="1.5"
                      fill="hsl(var(--card))"
                  />
                  {/* Cabin/Windows */}
                  <path 
                      d="M 95,55 L 285,55 L 285,145 L 95,145 Z"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="1"
                      fill="hsl(var(--muted))"
                  />
                  {/* Steering wheel (left-hand drive) */}
                  <circle cx="115" cy="125" r="8" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="2 2" />

                  <line x1="180" y1="55" x2="180" y2="145" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
                  <line x1="95" y1="99.5" x2="285" y2="99.5" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />

                  {/* Hood/Trunk lines */}
                  <line x1="90" y1="60" x2="90" y2="140" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
                  <line x1="285" y1="60" x2="285" y2="140" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
                  
                  {/* Side mirrors */}
                  <path d="M 105,35 L 100,40 L 120,40 L 125,35 Z" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--card))" strokeWidth="1"/>
                  <path d="M 105,165 L 100,160 L 120,160 L 125,165 Z" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--card))" strokeWidth="1"/>
              </g>
          </svg>

          {/* Interactive SVG Layer */}
          <div className="absolute top-0 left-0 w-full h-full">
              <svg viewBox="0 0 400 200" className="w-full h-full">
                  <g>
                      {carParts.map((part) => {
                          const damageKey = damages[part.id];
                          const damageInfo = damageKey ? damageTypes[damageKey] : undefined;

                          return (
                              <rect
                                  key={part.id}
                                  x={part.x}
                                  y={part.y}
                                  width={part.w}
                                  height={part.h}
                                  onClick={readOnly ? undefined : () => handlePartClick(part.id)}
                                  className={cn(
                                    "transition-colors",
                                    damageInfo ? damageInfo.color : "fill-transparent",
                                    !readOnly && "cursor-pointer",
                                    !readOnly && !damages[part.id] && "hover:fill-primary/20",
                                  )}
                              >
                                <title>{part.label}{damageInfo ? `: ${damageInfo.label}` : ''}</title>
                              </rect>
                          );
                      })}
                  </g>
              </svg>
          </div>
      </div>

      {showLegend && (
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
                      <div className={cn("w-3 h-3 flex items-center justify-center font-bold text-xs rounded-sm border", color.replace('bg-', 'border-'))}>
                         {type}
                      </div>
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
      )}
    </div>
  );
};

export default CarDamageDiagram;
