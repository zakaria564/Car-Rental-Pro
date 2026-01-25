
"use client";

import { cn } from '@/lib/utils';
import React from 'react';

// More detailed car parts for the diagram
const carParts = [
    // Front
    { id: 'parechoc_av_1', label: 'Pare-choc Avant', x: 35, y: 88, w: 10, h: 4 },
    { id: 'parechoc_av_2', label: 'Pare-choc Avant', x: 55, y: 88, w: 10, h: 4 },
    { id: 'capot_1', label: 'Capot', x: 35, y: 82, w: 10, h: 5 },
    { id: 'capot_2', label: 'Capot', x: 55, y: 82, w: 10, h: 5 },
    { id: 'phare_avg', label: 'Phare Avant Gauche', x: 68, y: 88, w: 5, h: 4 },
    { id: 'phare_avd', label: 'Phare Avant Droit', x: 27, y: 88, w: 5, h: 4 },
    { id: 'parebrise', label: 'Pare-brise', x: 45, y: 70, w: 10, h: 8 },
    
    // Left Side (of the car, which is on the right of the diagram)
    { id: 'aile_avg_1', label: 'Aile Avant Gauche', x: 74, y: 75, w: 4, h: 10 },
    { id: 'retro_g', label: 'Rétroviseur Gauche', x: 79, y: 65, w: 4, h: 4 },
    { id: 'porte_avg_1', label: 'Porte Avant Gauche', x: 74, y: 55, w: 4, h: 10 },
    { id: 'porte_arg_1', label: 'Porte Arrière Gauche', x: 74, y: 35, w: 4, h: 10 },
    { id: 'aile_arg_1', label: 'Aile Arrière Gauche', x: 74, y: 15, w: 4, h: 10 },
    
    // Right Side (of the car, which is on the left of the diagram)
    { id: 'aile_avd_1', label: 'Aile Avant Droite', x: 22, y: 75, w: 4, h: 10 },
    { id: 'retro_d', label: 'Rétroviseur Droit', x: 17, y: 65, w: 4, h: 4 },
    { id: 'porte_avd_1', label: 'Porte Avant Droite', x: 22, y: 55, w: 4, h: 10 },
    { id: 'porte_ard_1', label: 'Porte Arrière Droite', x: 22, y: 35, w: 4, h: 10 },
    { id: 'aile_ard_1', label: 'Aile Arrière Droite', x: 22, y: 15, w: 4, h: 10 },

    // Rear
    { id: 'lunette_ar', label: 'Lunette Arrière', x: 45, y: 10, w: 10, h: 8 },
    { id: 'coffre_1', label: 'Coffre', x: 35, y: 20, w: 10, h: 5 },
    { id: 'coffre_2', label: 'Coffre', x: 55, y: 20, w: 10, h: 5 },
    { id: 'parechoc_ar_1', label: 'Pare-choc Arrière', x: 35, y: 3, w: 10, h: 4 },
    { id: 'parechoc_ar_2', label: 'Pare-choc Arrière', x: 55, y: 3, w: 10, h: 4 },
    { id: 'phare_arg', label: 'Phare Arrière Gauche', x: 68, y: 4, w: 5, h: 4 },
    { id: 'phare_ard', label: 'Phare Arrière Droit', x: 27, y: 4, w: 5, h: 4 },

    // Top
    { id: 'toit_1', label: 'Toit', x: 45, y: 45, w: 10, h: 10 },

    // Wheels
    { id: 'roue_avg', label: 'Roue Avant Gauche', x: 80, y: 72, w: 6, h: 6 },
    { id: 'roue_arg', label: 'Roue Arrière Gauche', x: 80, y: 22, w: 6, h: 6 },
    { id: 'roue_avd', label: 'Roue Avant Droite', x: 14, y: 72, w: 6, h: 6 },
    { id: 'roue_ard', label: 'Roue Arrière Droite', x: 14, y: 22, w: 6, h: 6 },
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

            {/* Interactive Squares Overlay */}
            <g stroke="hsl(var(--muted-foreground))" strokeWidth="0.2">
                {carParts.map((part) => (
                    <rect
                        key={part.id}
                        x={part.x}
                        y={part.y}
                        width={part.w}
                        height={part.h}
                        onClick={() => handlePartClick(part.id)}
                        className={cn(
                            "transition-colors fill-transparent",
                            readOnly ? "" : "cursor-pointer hover:fill-yellow-300/50 hover:stroke-yellow-400",
                            damages[part.id] && "fill-destructive/70 stroke-destructive"
                        )}
                    >
                      <title>{part.label}</title>
                    </rect>
                ))}
            </g>
        </g>
      </svg>
    </div>
  );
};

export default CarDamageDiagram;
